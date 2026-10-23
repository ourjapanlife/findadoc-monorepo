import type { Environment } from 'aws-cdk-lib'

export const FINDADOC_ENV = {
    account: '677501681118',
    region: 'ap-northeast-1',
} as const satisfies Environment

export const FINDADOC_DOMAIN = 'findadoc.jp'
