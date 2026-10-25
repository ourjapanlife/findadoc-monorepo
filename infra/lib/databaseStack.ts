import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { BackupPlan, BackupPlanRule, BackupResource, BackupVault } from 'aws-cdk-lib/aws-backup'
import { InstanceClass, InstanceSize, InstanceType, Port, SecurityGroup, SubnetType, type IVpc } from 'aws-cdk-lib/aws-ec2'
import { Schedule } from 'aws-cdk-lib/aws-events'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
    CaCertificate,
    Credentials,
    DatabaseInstance,
    DatabaseInstanceEngine,
    ParameterGroup,
    PostgresEngineVersion,
    StorageType,
} from 'aws-cdk-lib/aws-rds'
import type { Construct } from 'constructs'

export interface DatabaseStackProps extends StackProps {
    vpc: IVpc
    // Login role the API connects as, with an IAM token instead of a password.
    apiDatabaseUser: string
}

// The API's PostgreSQL database. Single-AZ db.t4g.micro with 20 GB gp3: about
// $18.25 for the instance and $2.76 for storage a month in Tokyo. Backup storage
// is free up to the provisioned 20 GB.
//
// Recovery: 7 days of point-in-time restore, plus a monthly snapshot kept for
// 6 months. Single-AZ means a failed host is a restore from backup, roughly 15-30
// minutes. That was chosen over Multi-AZ, which doubles the instance cost.
export class DatabaseStack extends Stack {
    readonly instance: DatabaseInstance
    // Anything that connects to the database joins this security group.
    readonly clientSecurityGroup: SecurityGroup

    constructor(scope: Construct, id: string, props: DatabaseStackProps) {
        super(scope, id, props)

        this.clientSecurityGroup = new SecurityGroup(this, 'DatabaseClients', {
            vpc: props.vpc,
            description: 'Connects to the findadoc database',
            allowAllOutbound: true,
            allowAllIpv6Outbound: true,
        })

        const databaseSecurityGroup = new SecurityGroup(this, 'Database', {
            vpc: props.vpc,
            description: 'findadoc database',
            allowAllOutbound: false,
        })

        databaseSecurityGroup.addIngressRule(this.clientSecurityGroup, Port.tcp(5432), 'Database clients')

        const engine = DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_17_9 })

        this.instance = new DatabaseInstance(this, 'Instance', {
            instanceIdentifier: 'findadoc',
            engine,
            instanceType: InstanceType.of(InstanceClass.BURSTABLE4_GRAVITON, InstanceSize.MICRO),
            vpc: props.vpc,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [databaseSecurityGroup],
            publiclyAccessible: false,
            multiAz: false,
            allocatedStorage: 20,
            storageType: StorageType.GP3,
            storageEncrypted: true,
            databaseName: 'postgres',
            // The master user runs migrations. Its password lives in Secrets Manager.
            // The API never uses it: it connects as apiDatabaseUser with IAM auth.
            credentials: Credentials.fromGeneratedSecret('postgres', { secretName: 'findadoc/database/master' }),
            iamAuthentication: true,
            caCertificate: CaCertificate.RDS_CA_RSA2048_G1,
            parameterGroup: new ParameterGroup(this, 'Parameters', {
                engine,
                parameters: { 'rds.force_ssl': '1' },
            }),
            backupRetention: Duration.days(7),
            preferredBackupWindow: '18:00-18:30', // 03:00-03:30 in Japan
            preferredMaintenanceWindow: 'sun:19:00-sun:19:30',
            autoMinorVersionUpgrade: true,
            deletionProtection: true,
            removalPolicy: RemovalPolicy.SNAPSHOT,
            cloudwatchLogsExports: ['postgresql'],
            cloudwatchLogsRetention: RetentionDays.ONE_MONTH,
        })

        // One snapshot a month, kept for 6 months, on top of the 7-day automated backups.
        const vault = new BackupVault(this, 'BackupVault', {
            backupVaultName: 'findadoc-database',
            removalPolicy: RemovalPolicy.RETAIN,
        })
        const plan = new BackupPlan(this, 'MonthlyBackup', {
            backupPlanName: 'findadoc-database-monthly',
            backupVault: vault,
        })

        plan.addRule(new BackupPlanRule({
            ruleName: 'monthly',
            scheduleExpression: Schedule.cron({ day: '1', hour: '18', minute: '30' }),
            deleteAfter: Duration.days(180),
        }))
        plan.addSelection('Database', { resources: [BackupResource.fromRdsDatabaseInstance(this.instance)] })

        new CfnOutput(this, 'DatabaseEndpoint', { value: this.instance.dbInstanceEndpointAddress })
        // Lambda IAM policies name this id in rds-db:connect.
        new CfnOutput(this, 'DatabaseResourceId', { value: this.instance.instanceResourceId ?? '' })
        if (this.instance.secret) {
            new CfnOutput(this, 'MasterSecretArn', { value: this.instance.secret.secretArn })
        }
        new CfnOutput(this, 'ApiDatabaseUser', { value: props.apiDatabaseUser })
    }
}
