import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import { IpAddresses, IpProtocol, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'

// The API's network. Two private dual-stack subnets and no NAT gateway. Outbound
// traffic leaves over IPv6 through an egress-only internet gateway, which is free.
// Auth0, Google Places and Sentry all publish IPv6 addresses, so the API Lambda
// can reach them without a NAT gateway (about $45 a month). Nothing here is
// reachable from the internet.
export class NetworkStack extends Stack {
    readonly vpc: Vpc

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props)

        this.vpc = new Vpc(this, 'Vpc', {
            vpcName: 'findadoc',
            ipAddresses: IpAddresses.cidr('10.20.0.0/16'),
            ipProtocol: IpProtocol.DUAL_STACK,
            // Named, not looked up, so synth needs no AWS credentials. ap-northeast-1b is not
            // offered to new accounts.
            availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
            natGateways: 0,
            subnetConfiguration: [{
                name: 'private',
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                cidrMask: 22,
            }],
        })

        new CfnOutput(this, 'VpcId', { value: this.vpc.vpcId })
    }
}
