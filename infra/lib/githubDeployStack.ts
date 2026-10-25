import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { OidcProviderNative, PolicyStatement, Role, WebIdentityPrincipal } from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'

export interface GithubDeployStackProps extends StackProps {
    // owner/name, for example ourjapanlife/findadoc-monorepo
    repository: string
    // The sub claim before :ref:..., exactly as GitHub issues it for this repository.
    subjectPrefix: string
    // Only workflow runs on this branch can assume the deploy role.
    branch: string
    roleName: string
    // Regions besides the stack's own where CI deploys (their CDK bootstrap roles).
    additionalRegions?: string[]
}

// Lets GitHub Actions deploy the CDK app without stored AWS keys. The workflow
// gets a short-lived OIDC token, assumes this role, and the role can only
// assume the CDK bootstrap roles, which do the actual deploy.
//
// This stack is the one that grants CI access, so deploy it locally first:
// CI cannot assume a role that does not exist yet.
export class GithubDeployStack extends Stack {
    readonly role: Role

    constructor(scope: Construct, id: string, props: GithubDeployStackProps) {
        super(scope, id, props)

        const provider = new OidcProviderNative(this, 'GithubOidcProvider', {
            url: 'https://token.actions.githubusercontent.com',
            clientIds: ['sts.amazonaws.com'],
        })

        this.role = new Role(this, 'DeployRole', {
            roleName: props.roleName,
            description: `GitHub Actions CDK deploy for ${props.repository} on ${props.branch}`,
            maxSessionDuration: Duration.hours(1),
            assumedBy: new WebIdentityPrincipal(provider.oidcProviderArn, {
                StringEquals: {
                    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                    'token.actions.githubusercontent.com:sub': `${props.subjectPrefix}:ref:refs/heads/${props.branch}`,
                },
            }),
        })

        this.role.addToPolicy(new PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: [this.region, ...(props.additionalRegions ?? [])].map(region =>
                `arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${region}`),
        }))

        new CfnOutput(this, 'DeployRoleArn', { value: this.role.roleArn })
    }
}
