import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { LoggingLevel, SlackChannelConfiguration } from 'aws-cdk-lib/aws-chatbot'
import {
    Alarm,
    ComparisonOperator,
    Metric,
    TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import type { IDatabaseInstance } from 'aws-cdk-lib/aws-rds'
import { Topic } from 'aws-cdk-lib/aws-sns'
import type { Construct } from 'constructs'

export interface AlertsStackProps extends StackProps {
    slackWorkspaceId: string
    slackChannelId: string
    database: IDatabaseInstance
}

// Alarms post to Slack through AWS Chatbot (Amazon Q Developer in chat applications).
// SNS, Chatbot and the first 10 alarms are free, so these cost nothing.
//
// A Slack admin must authorize the workspace once in the AWS console before the
// first deploy. CloudFormation cannot do that step, and the channel configuration
// fails to create without it.
export class AlertsStack extends Stack {
    // Later stacks (the API and MCP Lambdas) send their alarms here too.
    readonly topic: Topic

    constructor(scope: Construct, id: string, props: AlertsStackProps) {
        super(scope, id, props)

        this.topic = new Topic(this, 'Alarms', {
            topicName: 'findadoc-alarms',
            displayName: 'findadoc alarms',
        })

        new SlackChannelConfiguration(this, 'SlackAlerts', {
            slackChannelConfigurationName: 'findadoc-alerts',
            slackWorkspaceId: props.slackWorkspaceId,
            slackChannelId: props.slackChannelId,
            notificationTopics: [this.topic],
            loggingLevel: LoggingLevel.NONE,
            // Read-only: Slack shows alarm details, but nobody can change AWS from the channel.
            guardrailPolicies: [ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess')],
        })

        const database = props.database

        this.notify(new Alarm(this, 'DatabaseFreeStorageLow', {
            alarmName: 'findadoc-database-free-storage-low',
            alarmDescription: 'RDS has less than 2 GB of its 20 GB free.',
            metric: database.metricFreeStorageSpace({ period: Duration.minutes(5) }),
            threshold: 2 * 1024 ** 3,
            comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        this.notify(new Alarm(this, 'DatabaseCpuHigh', {
            alarmName: 'findadoc-database-cpu-high',
            alarmDescription: 'RDS CPU has been above 80% for 15 minutes.',
            metric: database.metricCPUUtilization({ period: Duration.minutes(5) }),
            threshold: 80,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 3,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        // db.t4g instances run in unlimited mode. Sustained CPU past the burst
        // baseline is billed as surplus credits, so any charge is worth a message.
        this.notify(new Alarm(this, 'DatabaseSurplusCreditsCharged', {
            alarmName: 'findadoc-database-surplus-credits-charged',
            alarmDescription: 'RDS is being billed for CPU surplus credits.',
            metric: new Metric({
                namespace: 'AWS/RDS',
                metricName: 'CPUSurplusCreditsCharged',
                dimensionsMap: { DBInstanceIdentifier: database.instanceIdentifier },
                statistic: 'Sum',
                period: Duration.hours(1),
            }),
            threshold: 0,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        new CfnOutput(this, 'AlarmTopicArn', { value: this.topic.topicArn })
    }

    // Posts to Slack when the alarm fires and again when it recovers.
    notify(alarm: Alarm): void {
        const action = new SnsAction(this.topic)

        alarm.addAlarmAction(action)
        alarm.addOkAction(action)
    }
}
