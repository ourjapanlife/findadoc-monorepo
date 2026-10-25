import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import { CfnApp, CfnBranch, CfnDomain } from 'aws-cdk-lib/aws-amplify'
import type { Construct } from 'constructs'

export interface WebStackProps extends StackProps {
    domainName: string
    branchName: string
}

// Hosts the site on Amplify. The wildcard is one subdomain on the existing
// findadoc.jp zone. Amplify writes that Route 53 record because the zone is
// in this account. A name that already has a record stays on that record.
export class WebStack extends Stack {
    constructor(scope: Construct, id: string, props: WebStackProps) {
        super(scope, id, props)

        const app = new CfnApp(this, 'WebApp', {
            name: 'findadoc-web',
            platform: 'WEB',
            description: 'findadoc.jp site',
        })

        const branch = new CfnBranch(this, 'ProductionBranch', {
            appId: app.attrAppId,
            branchName: props.branchName,
            stage: 'PRODUCTION',
            enableAutoBuild: false,
            description: 'Production site',
        })

        const domain = new CfnDomain(this, 'SiteDomain', {
            appId: app.attrAppId,
            domainName: props.domainName,
            subDomainSettings: [{
                branchName: branch.attrBranchName,
                prefix: '*',
            }],
        })

        new CfnOutput(this, 'AmplifyAppId', { value: app.attrAppId })
        new CfnOutput(this, 'AmplifyDefaultDomain', { value: app.attrDefaultDomain })
        new CfnOutput(this, 'WildcardName', { value: `*.${domain.attrDomainName}` })
        new CfnOutput(this, 'CertificateRecord', { value: domain.attrCertificateRecord })
    }
}
