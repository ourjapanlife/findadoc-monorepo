import type { Environment } from 'aws-cdk-lib'

export const FINDADOC_ENV = {
    account: '677501681118',
    region: 'ap-northeast-1',
} as const satisfies Environment

export const FINDADOC_DOMAIN = 'findadoc.jp'

// The existing Route 53 zone, also cached in cdk.context.json. Named here so stacks
// outside ap-northeast-1 (the us-east-1 certificate) need no lookup.
export const FINDADOC_HOSTED_ZONE_ID = 'Z02936621Z4BCXTP4RWL0'

// CloudFront only accepts certificates from us-east-1.
export const EDGE_CERTIFICATE_ENV = {
    account: '677501681118',
    region: 'us-east-1',
} as const satisfies Environment

// The AWS API serves api-staging first. api.findadoc.jp moves at the cutover (#13).
export const API_STAGING_DOMAIN = 'api-staging.findadoc.jp'
export const API_DOMAIN = 'api.findadoc.jp'

// The MCP server serves mcp-staging first. mcp.findadoc.jp moves at the cutover (#13).
export const MCP_STAGING_DOMAIN = 'mcp-staging.findadoc.jp'
export const MCP_DOMAIN = 'mcp.findadoc.jp'

/**
 * How each hostname is attached to its CloudFront distribution.
 *
 * CloudFront refuses a hostname while that name's DNS resolves to another distribution, and
 * every *.findadoc.jp name without its own record resolves to the Amplify wildcard (FindadocWeb).
 * So a new hostname goes on in two deploys, as AWS documents for this error:
 * - 'dns': only its Route 53 A and AAAA records, pointing at our distribution
 * - 'live': the records, plus the hostname and certificate on the distribution
 * Merge 'dns', let it deploy, then change it to 'live'.
 * - 'alias': the hostname on the distribution without records, for a name whose records live
 *   outside CDK (api.findadoc.jp, switched by hand at the cutover)
 */
export type HostnameState = 'dns' | 'live' | 'alias'

export const API_HOSTNAMES: Record<string, HostnameState> = {
    [API_STAGING_DOMAIN]: 'live',
}

export const MCP_HOSTNAMES: Record<string, HostnameState> = {
    [MCP_STAGING_DOMAIN]: 'live',
}
// The MCP tools read the live directory. After the cutover this is the AWS API.
export const MCP_GRAPHQL_ENDPOINT = 'https://api.findadoc.jp'

// CloudFormation reads the findadoc/api secret only when the function changes. After
// editing a value in Secrets Manager, bump this so the next deploy picks it up.
export const API_SECRETS_REVISION = '1'

export const GITHUB_REPOSITORY = 'ourjapanlife/findadoc-monorepo'

// The repository uses GitHub's immutable OIDC subject, which names the owner and
// repository by ID as well as by name. Check it with
// gh api repos/ourjapanlife/findadoc-monorepo/actions/oidc/customization/sub
export const GITHUB_OIDC_SUBJECT_PREFIX = 'repo:ourjapanlife@85821867/findadoc-monorepo@1371540064'

// The deploy workflow assumes this role by name.
export const GITHUB_DEPLOY_ROLE_NAME = 'findadoc-github-cdk-deploy'

// .github/workflows/web.yml assumes these roles by name.
export const GITHUB_WEB_DEPLOY_ROLE_NAME = 'findadoc-github-web-deploy'
export const GITHUB_WEB_PREVIEW_ROLE_NAME = 'findadoc-github-web-preview'

// The API connects to RDS as this login role with an IAM auth token, never a password.
// The migration that creates it runs only on RDS, where the rds_iam role exists.
export const API_DATABASE_USER = 'findadoc_api'

// Alarms post to #alerts in the findadoc Slack workspace through AWS Chatbot.
export const SLACK_WORKSPACE_ID = 'T0259MW3JAX'
export const SLACK_ALERTS_CHANNEL_ID = 'C0CC371TLMS'
