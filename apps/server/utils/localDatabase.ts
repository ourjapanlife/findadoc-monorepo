import type pg from 'pg'
import { envVariables } from './environmentVariables.js'

/** The port `pnpm db:start` publishes when PGPORT is not set. kyselyClient uses the same default outside production. */
export const DEFAULT_LOCAL_DATABASE_PORT = 54322

const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])

export type LocalDatabaseConfig = pg.ClientConfig & {
    host: string
    port: number
    user: string
    password: string
    database: string
}

/**
 * The local Docker database. PGHOST, PGPORT, PGUSER, and PGPASSWORD override the defaults.
 * They are the same variables the API reads (src/kyselyClient.ts), so the seed, the reset,
 * the tests, and the API reach one database.
 */
export function localDatabaseConfig(): LocalDatabaseConfig {
    const rawPort = envVariables.pgPort() || String(DEFAULT_LOCAL_DATABASE_PORT)
    const port = Number(rawPort)

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(`PGPORT must be a port number, not "${rawPort}".`)
    }

    return {
        host: envVariables.pgHost() || '127.0.0.1',
        port,
        user: envVariables.pgUser() || 'postgres',
        password: envVariables.pgPassword() || 'postgres',
        database: 'postgres'
    }
}

/** True for this machine. The seed and the reset refuse any other host. */
export function isLocalHost(host: string): boolean {
    return localHosts.has(host.trim().toLowerCase())
}
