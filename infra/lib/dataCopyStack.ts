import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { SubnetType, type ISecurityGroup, type IVpc } from 'aws-cdk-lib/aws-ec2'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import type { DatabaseInstance } from 'aws-cdk-lib/aws-rds'
import type { Construct } from 'constructs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export interface DataCopyStackProps extends StackProps {
    vpc: IVpc
    database: DatabaseInstance
    databaseClients: ISecurityGroup
}

// Temporary (#81): the one-off function that copies Supabase into RDS from inside the VPC.
// It only runs when someone invokes it, so it costs nothing. Remove this stack after the
// cutover (#13).
export class DataCopyStack extends Stack {
    constructor(scope: Construct, id: string, props: DataCopyStackProps) {
        super(scope, id, props)

        const master = props.database.secret

        if (!master) {
            throw new Error('The database needs its generated master secret for the copy.')
        }

        const copyFunction = new NodejsFunction(this, 'Copy', {
            functionName: 'findadoc-db-copy',
            description: 'One-off: copies the Supabase database into RDS (#81)',
            entry: path.join(repoRoot, 'apps/server/src/lambdaCopy.ts'),
            handler: 'handler',
            runtime: Runtime.NODEJS_24_X,
            architecture: Architecture.ARM_64,
            memorySize: 1024,
            timeout: Duration.minutes(15),
            projectRoot: repoRoot,
            depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
            vpc: props.vpc,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [props.databaseClients],
            // Supabase's direct database host is IPv6-only. The egress-only gateway reaches it.
            ipv6AllowedForDualStack: true,
            logGroup: new LogGroup(this, 'CopyLogs', {
                logGroupName: '/aws/lambda/findadoc-db-copy',
                retention: RetentionDays.TWO_WEEKS,
                removalPolicy: RemovalPolicy.DESTROY,
            }),
            environment: {
                PGHOST: props.database.dbInstanceEndpointAddress,
                PGPORT: props.database.dbInstanceEndpointPort,
                PGUSER: 'postgres',
                PGPASSWORD: master.secretValueFromJson('password').unsafeUnwrap(),
                NODE_EXTRA_CA_CERTS: '/var/runtime/ca-cert.pem',
            },
            bundling: {
                format: OutputFormat.ESM,
                target: 'node24',
                mainFields: ['module', 'main'],
                externalModules: ['pg-native'],
                banner: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
            },
        })

        new CfnOutput(this, 'CopyFunctionName', { value: copyFunction.functionName })
    }
}
