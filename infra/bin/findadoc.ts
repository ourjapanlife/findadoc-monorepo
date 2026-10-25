import { App, Tags } from 'aws-cdk-lib'
import { DnsStack } from '../lib/dnsStack.js'
import {
    FINDADOC_DOMAIN,
    FINDADOC_ENV,
    GITHUB_DEPLOY_ROLE_NAME,
    GITHUB_OIDC_SUBJECT_PREFIX,
    GITHUB_REPOSITORY,
} from '../lib/environment.js'
import { GithubDeployStack } from '../lib/githubDeployStack.js'
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
})

new GithubDeployStack(app, 'FindadocGithubDeploy', {
    env: FINDADOC_ENV,
    repository: GITHUB_REPOSITORY,
    subjectPrefix: GITHUB_OIDC_SUBJECT_PREFIX,
    branch: 'main',
    roleName: GITHUB_DEPLOY_ROLE_NAME,
})
