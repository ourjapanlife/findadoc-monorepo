import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { CfnApp, CfnBranch, CfnDomain } from 'aws-cdk-lib/aws-amplify'
import { OpenIdConnectProvider, PolicyStatement, Role, WebIdentityPrincipal } from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'

export interface WebStackProps extends StackProps {
    domainName: string
    branchName: string
    repository: string
    // The sub claim before :ref:... or :pull_request, as GitHub issues it.
    subjectPrefix: string
    deployRoleName: string
    previewRoleName: string
}

// Client routes that `nuxi generate` does not write. Same set as apps/web/public/_redirects.
// ja-JP is generated, so it is not listed here.
const CLIENT_LOCALES = ['zh-CN', 'vi-VN', 'ko-KR', 'tl-PH', 'pt-BR', 'fr-FR', 'ru-RU', 'de-DE', 'it-IT']
const CLIENT_PATHS = ['search', 'u/<*>', 'login', 'login/<*>', 'my-page', 'my-page/<*>']

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

// Hosts the site on Amplify. The wildcard is one subdomain on the existing
// findadoc.jp zone. Amplify writes that Route 53 record because the zone is
// in this account. A name that already has a record stays on that record.
//
// Pull request previews are separate Amplify branches. They are not names
// under findadoc.jp, because the wildcard serves the production branch.
export class WebStack extends Stack {
    constructor(scope: Construct, id: string, props: WebStackProps) {
        super(scope, id, props)

        const app = new CfnApp(this, 'WebApp', {
            name: 'findadoc-web',
            platform: 'WEB',
            description: 'findadoc.jp site',
            buildSpec: siteBuildSpec(),
            customRules: siteRules(),
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

        const providerArn = OpenIdConnectProvider.fromOpenIdConnectProviderArn(
            this,
            'GithubOidcProvider',
            `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
        ).openIdConnectProviderArn

        const deployRole = githubWebRole(this, 'DeployRole', {
            providerArn,
            roleName: props.deployRoleName,
            subject: `${props.subjectPrefix}:ref:refs/heads/${props.branchName}`,
            description: `GitHub Actions publish of ${props.repository} to the Amplify production branch`,
        })
        grantAmplifyBranch(deployRole, this, props.branchName, false)

        const previewRole = githubWebRole(this, 'PreviewRole', {
            providerArn,
            roleName: props.previewRoleName,
            subject: `${props.subjectPrefix}:pull_request`,
            description: `GitHub Actions Amplify previews for ${props.repository}`,
        })
        grantAmplifyBranch(previewRole, this, 'pr-*', true)

        new CfnOutput(this, 'AmplifyAppId', { value: app.attrAppId })
        new CfnOutput(this, 'AmplifyDefaultDomain', { value: app.attrDefaultDomain })
        new CfnOutput(this, 'WildcardName', { value: `*.${domain.attrDomainName}` })
        new CfnOutput(this, 'CertificateRecord', { value: domain.attrCertificateRecord })
        new CfnOutput(this, 'WebDeployRoleArn', { value: deployRole.roleArn })
        new CfnOutput(this, 'WebPreviewRoleArn', { value: previewRole.roleArn })
    }
}

function githubWebRole(scope: Construct, id: string, props: {
    providerArn: string
    roleName: string
    subject: string
    description: string
}): Role {
    return new Role(scope, id, {
        roleName: props.roleName,
        description: props.description,
        maxSessionDuration: Duration.hours(1),
        assumedBy: new WebIdentityPrincipal(props.providerArn, {
            StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub': props.subject,
            },
        }),
    })
}

// Publishing a branch needs the deploy APIs on that branch. Creating and
// deleting a branch is only for previews. ListApps has no resource type.
function grantAmplifyBranch(role: Role, stack: Stack, branchName: string, manageBranch: boolean): void {
    const appArn = `arn:aws:amplify:${stack.region}:${stack.account}:apps/*`
    const branchArn = `${appArn}/branches/${branchName}`

    role.addToPolicy(new PolicyStatement({
        actions: ['amplify:ListApps'],
        resources: ['*'],
    }))
    role.addToPolicy(new PolicyStatement({
        actions: manageBranch
            ? ['amplify:GetApp', 'amplify:CreateBranch']
            : ['amplify:GetApp'],
        resources: [appArn],
    }))
    role.addToPolicy(new PolicyStatement({
        actions: [
            'amplify:GetBranch',
            'amplify:CreateDeployment',
            'amplify:StartDeployment',
            'amplify:GetJob',
            'amplify:ListJobs',
            ...(manageBranch ? ['amplify:DeleteBranch'] : []),
        ],
        resources: [branchArn, `${branchArn}/*`],
    }))
}

// `nuxi generate` writes index.html under apps/web/.output/public.
// Versions follow the repo pin so a console build matches CI.
function siteBuildSpec(): string {
    const nodeVersion = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim()
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { packageManager: string }
    const pnpmVersion = rootPackage.packageManager.replace(/^pnpm@/, '')

    return [
        'version: 1',
        'frontend:',
        '  phases:',
        '    preBuild:',
        '      commands:',
        `        - nvm install ${nodeVersion}`,
        `        - nvm use ${nodeVersion}`,
        '        - corepack enable',
        `        - corepack prepare pnpm@${pnpmVersion} --activate`,
        '        - pnpm install --frozen-lockfile',
        '    build:',
        '      commands:',
        '        - export NODE_OPTIONS=--max-old-space-size=4096',
        '        - export NUXT_SKIP_DIRECTORY_PRERENDER=true',
        '        - pnpm --filter @findadoc/graphql build',
        '        - pnpm --filter @findadoc/utils build',
        '        - pnpm --filter @findadoc/web build',
        '  artifacts:',
        '    baseDirectory: apps/web/.output/public',
        '    files:',
        "      - '**/*'",
    ].join('\n')
}

function siteRules(): CfnApp.CustomRuleProperty[] {
    const clientRules = ['', ...CLIENT_LOCALES].flatMap(locale => {
        const root = locale === '' ? '' : `/${locale}`
        return CLIENT_PATHS.map(path => ({
            source: `${root}/${path}`,
            target: '/200.html',
            status: '200',
        }))
    })

    return [
        { source: '/stats.js', target: 'https://cloud.umami.is/script.js', status: '200' },
        { source: '/api/send', target: 'https://gateway.umami.is/api/send', status: '200' },
        ...clientRules,
        { source: '/<*>', target: '/<*>.html', status: '404-200' },
    ]
}
