import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { migrate } from './migrations.js'

const remoteFlags = ['--linked', '--db-url']
const serverRoot = fileURLToPath(new URL('../..', import.meta.url))
const composeFile = 'docker/docker-compose-db.yml'

// Always the local database. Remote connection settings in the environment are ignored.
const localDatabase: pg.ClientConfig = {
    host: '127.0.0.1',
    port: 54322,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 2000
}

if (process.env.NODE_ENV === 'production') {
    console.error('db:reset only runs against the local database.')
    process.exit(1)
}

const extraArgs = process.argv.slice(2)

if (extraArgs.some(arg => remoteFlags.some(flag => arg === flag || arg.startsWith(`${flag}=`)))) {
    console.error('db:reset only runs against the local database.')
    process.exit(1)
}

const client = await connectToLocalDatabase()

try {
    await closeOtherConnections(client)
    // Drops every app table, including the migration history, then rebuilds from the files.
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
    await client.query('GRANT ALL ON SCHEMA public TO postgres, public')
    await migrate(client, { importSupabaseHistory: false })
    console.log('Reset local database.')
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
} finally {
    await client.end().catch(() => undefined)
}

/**
 * Connects to the local database. When nothing is listening, starts the Docker
 * database once (`pnpm db:start`) and waits for it.
 */
async function connectToLocalDatabase(): Promise<pg.Client> {
    const first = await tryConnect()

    if (first) {
        return first
    }

    console.error('The local database is not running. Starting it with Docker.')
    const started = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], {
        cwd: serverRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32'
    })

    if (started.error || started.status !== 0) {
        console.error('Docker is required to run the local database. Start Docker, then run `pnpm db:reset` again.')
        process.exit(1)
    }

    const second = await tryConnect()

    if (!second) {
        console.error('The local database started but did not accept a connection on 127.0.0.1:54322.')
        process.exit(1)
    }

    return second
}

async function tryConnect(): Promise<pg.Client | null> {
    const candidate = new pg.Client(localDatabase)

    try {
        await candidate.connect()
        return candidate
    } catch {
        await candidate.end().catch(() => undefined)
        return null
    }
}

// A dev server or test run holding a connection would block DROP SCHEMA.
async function closeOtherConnections(connection: pg.Client): Promise<void> {
    await connection.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'postgres'
          AND pid <> pg_backend_pid()
          AND usename = 'postgres'
    `)
}
