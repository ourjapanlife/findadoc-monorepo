import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import type { Function } from 'aws-cdk-lib/aws-lambda'
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53'
import {
    ConfigurationSet,
    ConfigurationSetTlsPolicy,
    EmailIdentity,
    Identity,
    SuppressionReasons,
} from 'aws-cdk-lib/aws-ses'
import type { Construct } from 'constructs'
import type { AlertsStack } from './alertsStack.js'

export interface EmailStackProps extends StackProps {
    domainName: string
    hostedZoneId: string
    apiFunction: Function
    alerts: AlertsStack
}

const CONFIGURATION_SET_NAME = 'findadoc'

// Verifies findadoc.jp in SES and lets the API Lambda send from that domain.
// The apex MX already points at Google (smtp.google.com). This stack does not
// change it. MAIL FROM is a subdomain, so Google keeps receiving the mail people
// send to @findadoc.jp.
//
// Cost while nothing sends: $0. Outbound mail is $0.10 per 1,000. No dedicated IPs.
export class EmailStack extends Stack {
    readonly identity: EmailIdentity

    constructor(scope: Construct, id: string, props: EmailStackProps) {
        super(scope, id, props)

        const fromAddress = `noreply@${props.domainName}`
        const mailFromDomain = `mail.${props.domainName}`

        // Imported, not created. FindadocDns already looked the zone up.
        const zone = PublicHostedZone.fromPublicHostedZoneAttributes(this, 'Zone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.domainName,
        })

        const configurationSet = new ConfigurationSet(this, 'ConfigurationSet', {
            configurationSetName: CONFIGURATION_SET_NAME,
            tlsPolicy: ConfigurationSetTlsPolicy.REQUIRE,
            reputationMetrics: true,
            suppressionReasons: SuppressionReasons.BOUNCES_AND_COMPLAINTS,
        })

        // Easy DKIM CNAMEs, plus the MAIL FROM MX and SPF, go into the existing zone.
        // mail.findadoc.jp still answers the website over the Amplify wildcard (A/AAAA).
        // The MX and TXT added here are only for SES.
        this.identity = new EmailIdentity(this, 'DomainIdentity', {
            identity: Identity.publicHostedZone(zone),
            mailFromDomain,
            configurationSet,
            // Bounces are tracked by the suppression list and the alarms below.
            // noreply@ is not a mailbox we read.
            feedbackForwarding: false,
        })

        const role = props.apiFunction.role
        if (role === undefined) {
            throw new Error('The API function needs a role so it can send mail.')
        }

        new Policy(this, 'ApiSendEmail', {
            policyName: 'findadoc-api-send-email',
            roles: [role],
            statements: [
                new PolicyStatement({
                    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
                    resources: [
                        this.identity.emailIdentityArn,
                        this.formatArn({
                            service: 'ses',
                            resource: 'configuration-set',
                            resourceName: configurationSet.configurationSetName,
                        }),
                    ],
                }),
            ],
        })

        // Literals, not stack outputs, so the API stack does not depend on this one.
        // Nothing in the API sends yet. A later feature reads these.
        props.apiFunction.addEnvironment('SES_FROM_ADDRESS', fromAddress)
        props.apiFunction.addEnvironment('SES_CONFIGURATION_SET', CONFIGURATION_SET_NAME)
        props.apiFunction.addEnvironment('SES_REGION', this.region)

        this.addAlarms(props.alerts, configurationSet.configurationSetName)

        new CfnOutput(this, 'FromAddress', { value: fromAddress })
        new CfnOutput(this, 'MailFromDomain', { value: mailFromDomain })
        new CfnOutput(this, 'IdentityArn', { value: this.identity.emailIdentityArn })
    }

    // AWS reviews the account around a 10% bounce rate and a 0.5% complaint rate.
    // These fire earlier. Reputation.BounceRate is a fraction: 0.05 is 5%.
    private addAlarms(alerts: AlertsStack, configurationSetName: string): void {
        const reputation = (metricName: string) => new Metric({
            namespace: 'AWS/SES',
            metricName,
            dimensionsMap: { 'ses:configuration-set': configurationSetName },
            statistic: 'Average',
            period: Duration.minutes(15),
        })

        alerts.notify(new Alarm(this, 'BounceRate', {
            alarmName: 'findadoc-email-bounce-rate',
            alarmDescription: 'SES bounce rate for the findadoc configuration set is above 5%.',
            metric: reputation('Reputation.BounceRate'),
            threshold: 0.05,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))

        alerts.notify(new Alarm(this, 'ComplaintRate', {
            alarmName: 'findadoc-email-complaint-rate',
            alarmDescription: 'SES complaint rate for the findadoc configuration set is above 0.1%.',
            metric: reputation('Reputation.ComplaintRate'),
            threshold: 0.001,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        }))
    }
}
