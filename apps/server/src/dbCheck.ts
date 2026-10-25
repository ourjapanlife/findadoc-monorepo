import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { envVariables } from '../utils/environmentVariables.js'
import { initializeLogger, logger } from './logger.js'

// The local database that `supabase start` serves. kyselyClient uses the same port outside production.
const localDatabasePort = 54322

export type DatabaseCheck = {
    ok: boolean
    target: string
    error?: string
}

export const checkLocalDatabase = async (): Promise<DatabaseCheck> => {
    const host = envVariables.pgHost() || '127.0.0.1'
    const target = `${host}:${localDatabasePort}`
    const client = new pg.Client({
        host,
        port: localDatabasePort,
        database: 'postgres',
        user: envVariables.pgUser(),
        password: envVariables.pgPassword(),
        connectionTimeoutMillis: 3000
    })

    try {
        await client.connect()
        await client.query('SELECT id FROM facilities LIMIT 1')

        return { ok: true, target }
    } catch (ex) {
        const error = ex instanceof Error ? ex.message : String(ex)

        return { ok: false, target, error }
    } finally {
        await client.end().catch(() => undefined)
    }
}

const invokedDirectly = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
    initializeLogger()

    const result = await checkLocalDatabase()

    if (result.ok) {
        logger.info(`Local database is reachable at ${result.target}`)
        process.exit(0)
    }

    logger.error(`Local database is not reachable at ${result.target}: ${result.error}`)
    process.exit(1)
}
