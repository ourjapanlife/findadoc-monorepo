import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { Alarm, ComparisonOperator, Stats, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'
import { SubnetType, type ISecurityGroup, type IVpc } from 'aws-cdk-lib/aws-ec2'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat, type BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs'
import { FilterPattern, LogGroup, MetricFilter, QueryDefinition, QueryString, RetentionDays } from 'aws-cdk-lib/aws-logs'
import type { DatabaseInstance } from 'aws-cdk-lib/aws-rds'
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager'
import { Trigger } from 'aws-cdk-lib/triggers'
import type { Construct } from 'constructs'
import type { AlertsStack } from './alertsStack.js'
import { addFunctionUrlEdge } from './functionUrlEdge.js'
import type { HostnameState } from './environment.js'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const serverRoot = path.join(repoRoot, 'apps/server')

// Lambda's Node.js 20+ runtimes only trust the RDS certificates when told to.
const RDS_CA_BUNDLE = '/var/runtime/ca-cert.pem'

export interface ApiStackProps extends StackProps {
    vpc: IVpc
    database: DatabaseInstance
    databaseClients: ISecurityGroup
    apiDatabaseUser: string
    apiSecret: ISecret
    certificate: ICertificate
    hostedZoneId: string
    zoneName: string
    // https://… for API_URL, such as https://api-staging.findadoc.jp
    apiUrl: string
    hostnames: Record<string, HostnameState>
    alerts: AlertsStack
    // Bumping it re-reads apiSecret on the next deploy.
    secretsRevision: string
}

// One esbuild bundle per function: ESM for Node 24, with pg-native left out
// (pg falls back to its JavaScript driver).
function bundling(afterBundling: (inputDir: string, outputDir: string) => string[]): BundlingOptions {
    return {
        format: OutputFormat.ESM,
        target: 'node24',
        mainFields: ['module', 'main'],
        externalModules: ['pg-native'],
        banner: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
        commandHooks: {
            beforeBundling: () => [],
            beforeInstall: () => [],
            afterBundling,
        },
    }
}

// The GraphQL API on Lambda behind CloudFront, plus the migration trigger.
// Cost at this traffic: inside the always-free Lambda (1M requests, 400k GB-seconds)
// and CloudFront (1 TB, 10M requests) allowances. No NAT gateway, no load balancer.
export class ApiStack extends Stack {
    readonly apiFunction: NodejsFunction

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props)

        const inVpc = {
            vpc: props.vpc,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [props.databaseClients],
        }
        const master = props.database.secret

        if (!master) {
            throw new Error('The database needs its generated master secret for migrations.')
        }

        // Migrations: runs during every deploy of this stack, before the API function changes.
        // It connects as the master user. A failed migration fails the deploy.
        const migrateFunction = new NodejsFunction(this, 'Migrate', {
            functionName: 'findadoc-db-migrate',
            description: 'Applies pending migrations to the findadoc database',
            entry: path.join(serverRoot, 'src/lambdaMigrate.ts'),
            handler: 'handler',
            runtime: Runtime.NODEJS_24_X,
            architecture: Architecture.ARM_64,
            memorySize: 512,
            timeout: Duration.minutes(5),
            projectRoot: repoRoot,
            depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
            ...inVpc,
            logGroup: new LogGroup(this, 'MigrateLogs', {
                logGroupName: '/aws/lambda/findadoc-db-migrate',
                retention: RetentionDays.ONE_MONTH,
                removalPolicy: RemovalPolicy.DESTROY,
            }),
            environment: {
                PGHOST: props.database.dbInstanceEndpointAddress,
                PGPORT: props.database.dbInstanceEndpointPort,
                PGUSER: 'postgres',
                PGPASSWORD: master.secretValueFromJson('password').unsafeUnwrap(),
                MIGRATIONS_DIR: '/var/task/migrations',
                NODE_EXTRA_CA_CERTS: RDS_CA_BUNDLE,
            },
            bundling: bundling((inputDir, outputDir) => [
                `mkdir -p ${outputDir}/migrations`,
                `cp ${inputDir}/apps/server/supabase/migrations/*.sql ${outputDir}/migrations/`,
            ]),
        })

        const secretValue = (key: string) => props.apiSecret.secretValueFromJson(key).unsafeUnwrap()

        this.apiFunction = new NodejsFunction(this, 'Api', {
            functionName: 'findadoc-api',
            description: 'findadoc GraphQL API',
            entry: path.join(serverRoot, 'src/lambda.ts'),
            handler: 'handler',
            runtime: Runtime.NODEJS_24_X,
            architecture: Architecture.ARM_64,
            memorySize: 1024,
            timeout: Duration.seconds(30),
            projectRoot: repoRoot,
            depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
            ...inVpc,
            // Outbound to Auth0, Google Places and Sentry goes over IPv6 through the
            // egress-only gateway, so no NAT gateway is needed.
            ipv6AllowedForDualStack: true,
            logGroup: new LogGroup(this, 'ApiLogs', {
                logGroupName: '/aws/lambda/findadoc-api',
                retention: RetentionDays.ONE_MONTH,
                removalPolicy: RemovalPolicy.DESTROY,
            }),
            environment: {
                NODE_ENV: 'production',
                API_URL: props.apiUrl,
                PGHOST: props.database.dbInstanceEndpointAddress,
                PGPORT: props.database.dbInstanceEndpointPort,
                PGUSER: props.apiDatabaseUser,
                DB_IAM_AUTH: 'true',
                DB_POOL_MAX: '2',
                NODE_EXTRA_CA_CERTS: RDS_CA_BUNDLE,
                LOG_LEVEL: 'info',
                SENTRY_ENVIRONMENT: 'staging',
                GOOGLE_API_KEY: secretValue('GOOGLE_API_KEY'),
                SENTRY_DSN: secretValue('SENTRY_DSN'),
                EDGE_SHARED_SECRET: secretValue('EDGE_SHARED_SECRET'),
                API_SECRETS_REVISION: props.secretsRevision,
            },
            bundling: bundling((inputDir, outputDir) => [
                `mkdir -p ${outputDir}/typeDefs`,
                `cp ${inputDir}/apps/server/src/typeDefs/schema.graphql ${outputDir}/typeDefs/`,
                `cp ${inputDir}/apps/server/src/vocabulary/municipalities.json ${outputDir}/`,
                `cp ${inputDir}/apps/server/.env.prod ${outputDir}/`,
            ]),
        })

        props.database.grantConnect(this.apiFunction, props.apiDatabaseUser)

        new Trigger(this, 'MigrateOnDeploy', {
            handler: migrateFunction,
            timeout: Duration.minutes(5),
            executeBefore: [this.apiFunction],
        })

        // CloudFront calls the Function URL. CORS and auth stay in the app.
        const { distribution, functionUrl } = addFunctionUrlEdge(this, {
            fn: this.apiFunction,
            label: 'API',
            name: 'findadoc-api',
            hostnames: props.hostnames,
            description: new URL(props.apiUrl).hostname,
            certificate: props.certificate,
            edgeSecret: secretValue('EDGE_SHARED_SECRET'),
            hostedZoneId: props.hostedZoneId,
            zoneName: props.zoneName,
            ids: {
                originRequest: 'ApiOriginRequest',
                viewerIp: 'ViewerIp',
                distribution: 'ApiDistribution',
            },
        })

        this.addAlarms(props.alerts)
        this.addQueries()

        new CfnOutput(this, 'ApiUrl', { value: props.apiUrl })
        new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName })
        new CfnOutput(this, 'FunctionUrl', { value: functionUrl.url })
    }

    private addAlarms(alerts: AlertsStack): void {
        const fn = this.apiFunction

        alerts.notify(new Alarm(this, 'ApiErrors', {
            alarmName: 'findadoc-api-errors',
            alarmDescription: 'The API Lambda failed more than 5 times in 5 minutes.',
            metric: fn.metricErrors({ period: Duration.minutes(5), statistic: Stats.SUM }),
            threshold: 5,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        alerts.notify(new Alarm(this, 'ApiSlow', {
            alarmName: 'findadoc-api-p95-duration',
            alarmDescription: 'API p95 duration has been above 3 seconds for 15 minutes.',
            metric: fn.metricDuration({ period: Duration.minutes(5), statistic: Stats.p(95) }),
            threshold: 3000,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 3,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        alerts.notify(new Alarm(this, 'ApiThrottles', {
            alarmName: 'findadoc-api-throttles',
            alarmDescription: 'Lambda throttled API requests (the account concurrency limit was reached).',
            metric: fn.metricThrottles({ period: Duration.minutes(5), statistic: Stats.SUM }),
            threshold: 0,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        // One data point per failed search, from the request log line (apps/server/src/requestErrors.ts).
        const searchFailures = new MetricFilter(this, 'SearchFailures', {
            logGroup: fn.logGroup,
            filterName: 'findadoc-api-search-failures',
            filterPattern: FilterPattern.all(
                FilterPattern.stringValue('$.type', '=', 'graphql'),
                FilterPattern.booleanValue('$.searchFailed', true),
            ),
            metricNamespace: 'findadoc',
            metricName: 'SearchFailures',
            metricValue: '1',
        })

        alerts.notify(new Alarm(this, 'ApiSearchFailures', {
            alarmName: 'findadoc-api-search-failures',
            alarmDescription: 'A facility or professional search failed on the server.',
            metric: searchFailures.metric({ period: Duration.minutes(5), statistic: Stats.SUM }),
            threshold: 1,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))
    }

    // Saved Logs Insights queries, listed under "Saved queries" for the API log group. Free.
    private addQueries(): void {
        const logGroups = [this.apiFunction.logGroup]

        new QueryDefinition(this, 'SlowOperations', {
            queryDefinitionName: 'findadoc/api/slow-operations',
            logGroups,
            queryString: new QueryString({
                filterStatements: ['type = "graphql"'],
                statsStatements: ['avg(durationMs) as avgMs, pct(durationMs, 95) as p95Ms, count(*) as requests by operationName'],
                sort: 'p95Ms desc',
            }),
        })

        new QueryDefinition(this, 'ErrorsByOperation', {
            queryDefinitionName: 'findadoc/api/errors-by-operation',
            logGroups,
            queryString: new QueryString({
                filterStatements: ['type = "graphql"', 'serverErrorCount > 0'],
                statsStatements: ['count(*) as failed by operationName, rootFields.0'],
                sort: 'failed desc',
            }),
        })

        new QueryDefinition(this, 'FailedSearches', {
            queryDefinitionName: 'findadoc/api/failed-searches',
            logGroups,
            queryString: new QueryString({
                fields: ['@timestamp', 'requestId', 'operationName', 'durationMs'],
                filterStatements: ['type = "graphql"', 'searchFailed = 1'],
                sort: '@timestamp desc',
                limit: 100,
            }),
        })
    }
}
