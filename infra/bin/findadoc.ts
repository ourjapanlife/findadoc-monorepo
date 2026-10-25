import { App, Tags } from 'aws-cdk-lib'
import { DatabaseStack } from '../lib/databaseStack.js'
import { DnsStack } from '../lib/dnsStack.js'
import {
    API_DATABASE_USER,
    FINDADOC_DOMAIN,
    FINDADOC_ENV,
    GITHUB_DEPLOY_ROLE_NAME,
    GITHUB_OIDC_SUBJECT_PREFIX,
    GITHUB_REPOSITORY,
    GITHUB_WEB_DEPLOY_ROLE_NAME,
    GITHUB_WEB_PREVIEW_ROLE_NAME,
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

new DatabaseStack(app, 'FindadocDatabase', {
    env: FINDADOC_ENV,
    vpc: network.vpc,
    apiDatabaseUser: API_DATABASE_USER,
})

new GithubDeployStack(app, 'FindadocGithubDeploy', {
    env: FINDADOC_ENV,
    repository: GITHUB_REPOSITORY,
    subjectPrefix: GITHUB_OIDC_SUBJECT_PREFIX,
    branch: 'main',
    roleName: GITHUB_DEPLOY_ROLE_NAME,
})
