import { Stack, type StackProps } from 'aws-cdk-lib'
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager'
import { HostedZone } from 'aws-cdk-lib/aws-route53'
import type { Construct } from 'constructs'

export interface EdgeCertificateStackProps extends StackProps {
    hostedZoneId: string
    zoneName: string
    // The first name is the certificate's subject. The rest are alternative names.
    apiDomainNames: string[]
}

// CloudFront only accepts certificates from us-east-1, so this one stack lives there.
// The certificate is DNS-validated in the findadoc.jp zone and is free.
// The CDK bootstrap has to exist in us-east-1 before the first deploy (see the README).
export class EdgeCertificateStack extends Stack {
    readonly apiCertificate: Certificate

    constructor(scope: Construct, id: string, props: EdgeCertificateStackProps) {
        super(scope, id, props)

        const zone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.zoneName,
        })
        const [domainName, ...subjectAlternativeNames] = props.apiDomainNames

        this.apiCertificate = new Certificate(this, 'ApiCertificate', {
            domainName,
            subjectAlternativeNames,
            validation: CertificateValidation.fromDns(zone),
        })
    }
}
