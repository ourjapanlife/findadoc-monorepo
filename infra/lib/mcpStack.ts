import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { Alarm, ComparisonOperator, Stats, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager'
import type { Construct } from 'constructs'
import type { AlertsStack } from './alertsStack.js'
import { addFunctionUrlEdge } from './functionUrlEdge.js'
import type { HostnameState } from './environment.js'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export interface McpStackProps extends StackProps {
    // The GraphQL API every tool calls.
    graphqlEndpoint: string
    // Holds EDGE_SHARED_SECRET, shared with the API's CloudFront.
    apiSecret: ISecret
    certificate: ICertificate
    hostedZoneId: string
    zoneName: string
    hostnames: Record<string, HostnameState>
    // For the distribution's comment and the McpUrl output.
    primaryHostname: string
    alerts: AlertsStack
}

// The MCP server (apps/mcp) on Lambda behind CloudFront. It has no database and only calls
// the public GraphQL API, so it runs outside the VPC. Inside the Lambda and CloudFront
// free tiers at this traffic.
export class McpStack extends Stack {
    constructor(scope: Construct, id: string, props: McpStackProps) {
        super(scope, id, props)

        const mcpFunction = new NodejsFunction(this, 'Mcp', {
            functionName: 'findadoc-mcp',
            description: 'findadoc MCP server and REST/OpenAPI routes',
            entry: path.join(repoRoot, 'apps/mcp/src/lambda.ts'),
            handler: 'handler',
            runtime: Runtime.NODEJS_24_X,
            architecture: Architecture.ARM_64,
            memorySize: 512,
            timeout: Duration.seconds(30),
            projectRoot: repoRoot,
            depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
            logGroup: new LogGroup(this, 'McpLogs', {
                logGroupName: '/aws/lambda/findadoc-mcp',
                retention: RetentionDays.ONE_MONTH,
                removalPolicy: RemovalPolicy.DESTROY,
            }),
            environment: {
                GRAPHQL_ENDPOINT: props.graphqlEndpoint,
                OPENAPI_PATH: '/var/task/openapi.yaml',
                EDGE_SHARED_SECRET: props.apiSecret.secretValueFromJson('EDGE_SHARED_SECRET').unsafeUnwrap(),
            },
            bundling: {
                format: OutputFormat.ESM,
                target: 'node24',
                mainFields: ['module', 'main'],
                banner: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
                commandHooks: {
                    beforeBundling: () => [],
                    beforeInstall: () => [],
                    afterBundling: (inputDir, outputDir) => [`cp ${inputDir}/apps/mcp/openapi.yaml ${outputDir}/`],
                },
            },
        })

        addFunctionUrlEdge(this, {
            fn: mcpFunction,
            label: 'MCP',
            name: 'findadoc-mcp',
            hostnames: props.hostnames,
            description: props.primaryHostname,
            certificate: props.certificate,
            edgeSecret: props.apiSecret.secretValueFromJson('EDGE_SHARED_SECRET').unsafeUnwrap(),
            hostedZoneId: props.hostedZoneId,
            zoneName: props.zoneName,
            ids: {
                originRequest: 'McpOriginRequest',
                viewerIp: 'ViewerIp',
                distribution: 'McpDistribution',
            },
        })

        props.alerts.notify(new Alarm(this, 'McpErrors', {
            alarmName: 'findadoc-mcp-errors',
            alarmDescription: 'The MCP Lambda failed more than 5 times in 5 minutes.',
            metric: mcpFunction.metricErrors({ period: Duration.minutes(5), statistic: Stats.SUM }),
            threshold: 5,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        new CfnOutput(this, 'McpUrl', { value: `https://${props.primaryHostname}/mcp` })
    }
}
