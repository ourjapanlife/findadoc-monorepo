import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import { HostedZone, type IHostedZone } from 'aws-cdk-lib/aws-route53'
import type { Construct } from 'constructs'

export interface DnsStackProps extends StackProps {
    domainName: string
}

// The findadoc.jp zone already exists in the account. This stack only looks it
// up so other stacks can add records to it; it does not create or own the zone.
export class DnsStack extends Stack {
    readonly hostedZone: IHostedZone

    constructor(scope: Construct, id: string, props: DnsStackProps) {
        super(scope, id, props)

        // The lookup result is cached in cdk.context.json. Commit that file so
        // synth is repeatable without AWS credentials.
        this.hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
            domainName: props.domainName,
        })

        new CfnOutput(this, 'HostedZoneId', { value: this.hostedZone.hostedZoneId })
        new CfnOutput(this, 'HostedZoneName', { value: this.hostedZone.zoneName })
    }
}
