import { Kysely, PostgresDialect } from 'kysely'
import { Signer } from '@aws-sdk/rds-signer'
import { Pool, types, type PoolConfig } from 'pg'
import type { Database } from './typeDefs/kyselyTypes.js'
import { logger } from './logger.js'
import { envVariables } from '../utils/environmentVariables.js'

let pool: Pool | null = null

const TIMESTAMPTZ_OID = 1184

/**
 * Reads a timestamptz as the ISO string PostgREST used to return, such as
 * 2026-10-25T03:00:00.123456+00:00, instead of a Date. A Date would reach a
 * GraphQL String field as epoch milliseconds.
 */
export function timestamptzToIso(value: string): string {
    return value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
}

const getTypeParser: typeof types.getTypeParser = ((oid: number, format?: 'text' | 'binary') =>
    oid === TIMESTAMPTZ_OID && format !== 'binary'
        ? timestamptzToIso
        : types.getTypeParser(oid, format)) as typeof types.getTypeParser
let kyselyInstance: Kysely<Database> | null = null

/**
 * Connection settings from the environment. PGPORT and DB_POOL_MAX override the defaults:
 * the Supabase pooler (6543) in production, local Docker (54322) otherwise, and 100 connections.
 * With DB_IAM_AUTH=true (RDS), each new connection signs a 15-minute IAM token with the
 * function's role instead of using a password, and TLS is required.
 */
export function poolConfig(): PoolConfig {
    const host = envVariables.pgHost()
    const port = Number(envVariables.pgPort() ?? (envVariables.isProduction() ? 6543 : 54322))
    const user = envVariables.pgUser()
    const iamAuth = envVariables.dbIamAuth()
    const signer = iamAuth && host && user
        ? new Signer({ hostname: host, port, username: user, region: process.env.AWS_REGION })
        : null

    return {
        host,
        port,
        database: 'postgres',
        user,
        password: signer ? () => signer.getAuthToken() : envVariables.pgPassword(),
        ssl: iamAuth || envVariables.dbSsl() ? { rejectUnauthorized: true } : undefined,
        max: Number(envVariables.dbPoolMax() ?? 100),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        types: { getTypeParser }
    }
}

/**
 * Initialize Kysely client with connection pool
 * Should be called once at application startup, after environment variables are loaded
 */
export async function initializeKyselyClient(): Promise<void> {
    if (kyselyInstance) {
        logger.warn('Kysely client already initialized')
        return
    }

    logger.info('🔌 Initializing Kysely client...')

    /**
 * PostgreSQL Connection Pool
 * The pool manages a set of reusable database connections.
 * Instead of opening a new connection for every query (slow and resource-intensive),
 * the pool maintains a set of open connections that can be reused.
 * Configuration:
 * - connectionString: Uses DATABASE_URL from .env (same database as Supabase)
 * - max: 10 connections in the pool (enough for dev and moderate production traffic)
 * - idleTimeoutMillis: Close idle connections after 30 seconds to free resources
 * - connectionTimeoutMillis: Fail fast if can't acquire a connection within 2 seconds
 */
    pool = new Pool(poolConfig())

    /**
 * Pool error handler
 * Catches connection-level errors that happen outside of query execution.
 * Without this handler, pool errors could crash the entire application.
 */
    pool.on('error', err => {
        logger.error('Unexpected error on idle PostgreSQL client', err)
    })

    // Create Kysely instance
    kyselyInstance = new Kysely<Database>({
        dialect: new PostgresDialect({ pool })
    })

    // Test connection
    try {
        logger.info('🧪 Testing Kysely connection to PostgreSQL...')
    
        await kyselyInstance
            .selectFrom('facilities')
            .select('id')
            .limit(1)
            .execute()
    
        logger.info('✅ Kysely client initialized and connected successfully!')
    } catch (error) {
        logger.error('❌ Kysely connection test failed:', error)

        const failedClient = kyselyInstance
        const failedPool = pool
        if (kyselyInstance === failedClient) {
            kyselyInstance = null
        }
        if (pool === failedPool) {
            pool = null
        }
        await failedClient?.destroy()

        throw new Error(`Failed to connect to PostgreSQL: ${error}`)
    }
}

/**
 * Get the Kysely database instance
 * Throws an error if not initialized
 */
function getKyselyClient(): Kysely<Database> {
    if (!kyselyInstance) {
        throw new Error(
            'Kysely client not initialized. Call initializeKyselyClient() first.'
        )
    }
    return kyselyInstance
}

/**
 * For backward compatibility - export as 'db'
 * But this will throw if not initialized
 */
export const db = new Proxy({} as Kysely<Database>, {
    get(_target, prop) {
        const instance = getKyselyClient()
        const value = instance[prop as keyof Kysely<Database>]

        return typeof value === 'function' ? value.bind(instance) : value
    }
})

/**
 * Graceful Shutdown
 * 
 * Properly closes all database connections when the application shuts down.
 * This prevents:
 * - Connection leaks
 * - "Connection refused" errors in logs
 * - The process hanging on exit
 */
export async function closeDatabase(): Promise<void> {
    const client = kyselyInstance

    if (!client) {
        logger.warn('Kysely client not initialized, nothing to close')
        return
    }

    kyselyInstance = null
    pool = null

    try {
        await client.destroy()
        logger.info('✅ Database connection pool closed successfully')
    } catch (error) {
        logger.error('Error closing database connection pool:', error)
        throw error
    }
}

/**
 * Health Check
 * 
 * Verifies that the database is reachable and accepting queries.
 * Useful for:
 * - Health check endpoints (e.g., /health)
 * - Startup verification
 * - Monitoring systems
 */
export async function checkDatabaseHealth(): Promise<boolean> {
    if (!kyselyInstance) {
        logger.error('Kysely client not initialized')
        return false
    }

    try {
        await kyselyInstance.selectFrom('facilities').select('id').limit(1).execute()
        return true
    } catch (error) {
        logger.error('Database health check failed:', error)
        return false
    }
}
