import { App, Tags } from 'aws-cdk-lib'
import { AlertsStack } from '../lib/alertsStack.js'
import { ApiSecretsStack } from '../lib/apiSecretsStack.js'
import { ApiStack } from '../lib/apiStack.js'
import { DatabaseStack } from '../lib/databaseStack.js'
import { DnsStack } from '../lib/dnsStack.js'
import { EdgeCertificateStack } from '../lib/edgeCertificateStack.js'
import { McpStack } from '../lib/mcpStack.js'
import {
    API_DATABASE_USER,
    API_DOMAIN,
    API_SECRETS_REVISION,
    API_STAGING_DOMAIN,
    EDGE_CERTIFICATE_ENV,
    FINDADOC_DOMAIN,
    FINDADOC_ENV,
    FINDADOC_HOSTED_ZONE_ID,
    GITHUB_DEPLOY_ROLE_NAME,
    GITHUB_OIDC_SUBJECT_PREFIX,
    GITHUB_REPOSITORY,
    GITHUB_WEB_DEPLOY_ROLE_NAME,
    GITHUB_WEB_PREVIEW_ROLE_NAME,
    MCP_DOMAIN,
    MCP_GRAPHQL_ENDPOINT,
    MCP_STAGING_DOMAIN,
    SLACK_ALERTS_CHANNEL_ID,
    SLACK_WORKSPACE_ID,
} from '../lib/environment.js'
import { GithubDeployStack } from '../lib/githubDeployStack.js'
import { NetworkStack } from '../lib/networkStack.js'
import { WebStack } from '../lib/webStack.js'

const app = new App()

Tags.of(app).add('project', 'findadoc')
Tags.of(app).add('managed-by', 'cdk')

new DnsStack(app, 'FindadocDns', {
    env: FINDADOC_ENV,
    domainName: FINDADOC_DOMAIN,
})

new WebStack(app, 'FindadocWeb', {
    env: FINDADOC_ENV,
    domainName: FINDADOC_DOMAIN,
    branchName: 'main',
    repository: GITHUB_REPOSITORY,
    subjectPrefix: GITHUB_OIDC_SUBJECT_PREFIX,
    deployRoleName: GITHUB_WEB_DEPLOY_ROLE_NAME,
    previewRoleName: GITHUB_WEB_PREVIEW_ROLE_NAME,
})

const network = new NetworkStack(app, 'FindadocNetwork', {
    env: FINDADOC_ENV,
})

const database = new DatabaseStack(app, 'FindadocDatabase', {
    env: FINDADOC_ENV,
    vpc: network.vpc,
    apiDatabaseUser: API_DATABASE_USER,
})

const alerts = new AlertsStack(app, 'FindadocAlerts', {
    env: FINDADOC_ENV,
    slackWorkspaceId: SLACK_WORKSPACE_ID,
    slackChannelId: SLACK_ALERTS_CHANNEL_ID,
    database: database.instance,
})

const githubDeploy = new GithubDeployStack(app, 'FindadocGithubDeploy', {
    env: FINDADOC_ENV,
    repository: GITHUB_REPOSITORY,
    subjectPrefix: GITHUB_OIDC_SUBJECT_PREFIX,
    branch: 'main',
    roleName: GITHUB_DEPLOY_ROLE_NAME,
    // The CloudFront certificate stack deploys to us-east-1.
    additionalRegions: [EDGE_CERTIFICATE_ENV.region],
})

const edgeCertificates = new EdgeCertificateStack(app, 'FindadocEdgeCertificates', {
    env: EDGE_CERTIFICATE_ENV,
    crossRegionReferences: true,
    hostedZoneId: FINDADOC_HOSTED_ZONE_ID,
    zoneName: FINDADOC_DOMAIN,
    apiDomainNames: [API_STAGING_DOMAIN, API_DOMAIN],
    mcpDomainNames: [MCP_STAGING_DOMAIN, MCP_DOMAIN],
})

// The deploy role can use the us-east-1 bootstrap only after this change reaches it.
edgeCertificates.addStackDependency(githubDeploy)

const apiSecrets = new ApiSecretsStack(app, 'FindadocApiSecrets', {
    env: FINDADOC_ENV,
})

new ApiStack(app, 'FindadocApi', {
    env: FINDADOC_ENV,
    crossRegionReferences: true,
    vpc: network.vpc,
    database: database.instance,
    databaseClients: database.clientSecurityGroup,
    apiDatabaseUser: API_DATABASE_USER,
    apiSecret: apiSecrets.secret,
    certificate: edgeCertificates.apiCertificate,
    hostedZoneId: FINDADOC_HOSTED_ZONE_ID,
    zoneName: FINDADOC_DOMAIN,
    domainName: API_STAGING_DOMAIN,
    alerts,
    secretsRevision: API_SECRETS_REVISION,
})

new McpStack(app, 'FindadocMcp', {
    env: FINDADOC_ENV,
    crossRegionReferences: true,
    graphqlEndpoint: MCP_GRAPHQL_ENDPOINT,
    apiSecret: apiSecrets.secret,
    certificate: edgeCertificates.mcpCertificate,
    hostedZoneId: FINDADOC_HOSTED_ZONE_ID,
    zoneName: FINDADOC_DOMAIN,
    domainName: MCP_STAGING_DOMAIN,
    alerts,
})
