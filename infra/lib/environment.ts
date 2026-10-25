import type { Environment } from 'aws-cdk-lib'

export const FINDADOC_ENV = {
    account: '677501681118',
    region: 'ap-northeast-1',
} as const satisfies Environment

export const FINDADOC_DOMAIN = 'findadoc.jp'

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
