import { config } from 'dotenv'

console.log(`\n🔌 Loading environment: ${process.env.NODE_ENV}...`)

const dotEnvFileToLoad = process.env.NODE_ENV === 'production' ? './.env.prod' : './.env.dev'

config({ path: dotEnvFileToLoad })

const envVariables = {
    isProduction: () => process.env.NODE_ENV === 'production',
    isTestingEnvironment: () => process.env.TEST_ENABLED === 'true',
    isLocal: () => !envVariables.isProduction(),
    serverHost: () => process.env.SERVER_HOST as string,
    serverPort: () => process.env.SERVER_PORT as string,
    apiURL: () => process.env.API_URL as string,
    websiteURL: () => process.env.WEBSITE_URL as string,
    logLevel: () => process.env.LOG_LEVEL,
    authAuth0APIKey: () => process.env.AUTH_AUTH0_API_KEY as string,
    authAuth0URL: () => process.env.AUTH_AUTH0_URL as string,
    // A machine-to-machine app with read:users and read:roles. Only utils/importAuth0Roles.ts reads these.
    auth0ManagementClientId: () => process.env.AUTH0_MANAGEMENT_CLIENT_ID,
    auth0ManagementClientSecret: () => process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
    authGithubClientId: () => process.env.AUTH_GITHUB_CLIENT_ID as string,
    authGithubClientSecret: () => process.env.AUTH_GITHUB_CLIENT_SECRET as string,
    googleAPIKey: () => process.env.GOOGLE_API_KEY,
    pgPassword: () => process.env.PGPASSWORD,
    pgUser: () => process.env.PGUSER,
    pgHost: () => process.env.PGHOST,
    dbUrl: () => process.env.DB_URL || process.env.DATABASE_URL,
    pgPort: () => process.env.PGPORT,
    // RDS: sign in with an IAM auth token instead of PGPASSWORD. Implies TLS.
    dbIamAuth: () => process.env.DB_IAM_AUTH === 'true',
    dbSsl: () => process.env.PGSSLMODE === 'require',
    dbPoolMax: () => process.env.DB_POOL_MAX,
    // Sent by CloudFront in x-findadoc-edge. See clientIpFrom in @findadoc/utils.
    edgeSharedSecret: () => process.env.EDGE_SHARED_SECRET,
    pgDatabase: () => process.env.DATABASE_URL,
    sentryDsn: () => process.env.SENTRY_DSN,
    sentryEnvironment: () =>
        process.env.SENTRY_ENVIRONMENT
        ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    sentryTracesSampleRate: () => {
        const raw = process.env.SENTRY_TRACES_SAMPLE_RATE
        const parsed = raw ? Number(raw) : NaN

        if (!Number.isFinite(parsed)) {
            return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
        }
        return parsed
    },
    /** `s3` uses the uploads bucket. Anything else keeps files in the local API store. */
    storageBackend: () => process.env.STORAGE_BACKEND ?? 'none',
    s3Bucket: () => process.env.S3_BUCKET,
    s3Region: () => process.env.S3_REGION ?? process.env.AWS_REGION ?? 'ap-northeast-1',
    sesFromAddress: () => process.env.SES_FROM_ADDRESS,
    sesConfigurationSet: () => process.env.SES_CONFIGURATION_SET,
    sesRegion: () => process.env.SES_REGION ?? process.env.AWS_REGION ?? 'ap-northeast-1'
}

console.log('🔌 Loaded env variables 🔌')

export { envVariables }
