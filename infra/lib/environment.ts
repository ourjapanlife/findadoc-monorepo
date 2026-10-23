import type { Environment } from 'aws-cdk-lib'

export const FINDADOC_ENV = {
    account: '677501681118',
    region: 'ap-northeast-1',
} as const satisfies Environment

export const FINDADOC_DOMAIN = 'findadoc.jp'

export const GITHUB_REPOSITORY = 'ourjapanlife/findadoc-monorepo'

// The deploy workflow assumes this role by name.
export const GITHUB_DEPLOY_ROLE_NAME = 'findadoc-github-cdk-deploy'
