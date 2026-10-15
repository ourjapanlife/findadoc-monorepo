import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const remoteFlags = ['--linked', '--db-url']
const remoteEnv = ['SUPABASE_DB_URL', 'DATABASE_URL', 'DB_URL', 'POSTGRES_URL', 'SUPABASE_DB_PASSWORD']
const serverRoot = fileURLToPath(new URL('../..', import.meta.url))

if (process.env.NODE_ENV === 'production') {
    console.error('db:reset only runs against the local database.')
    process.exit(1)
}

const extraArgs = process.argv.slice(2)

if (extraArgs.some(arg => remoteFlags.some(flag => arg === flag || arg.startsWith(`${flag}=`)))) {
    console.error('db:reset only runs against the local database.')
    process.exit(1)
}

const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development' }

for (const name of remoteEnv) {
    delete env[name]
}

await closeLocalAppConnections()

let status = supabase(['db', 'reset', '--local', '--no-seed', '--yes'])

if (status !== 0) {
    console.error('Local reset did not finish. Starting the local Supabase containers and trying once more.')
    const started = supabase(['start'])

    if (started === 0) {
        await closeLocalAppConnections()
        status = supabase(['db', 'reset', '--local', '--no-seed', '--yes'])
    }
}

process.exit(status)

function supabase(args: string[]): number {
    const result = spawnSync('pnpm', ['exec', 'supabase', ...args], {
        cwd: serverRoot,
        stdio: 'inherit',
        env,
        shell: process.platform === 'win32'
    })

    if (result.error) {
        console.error('The Supabase CLI is required to reset the local database.')
        return 1
    }

    return result.status ?? 1
}

async function closeLocalAppConnections(): Promise<void> {
    const client = new pg.Client({
        host: '127.0.0.1',
        port: 54322,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres',
        connectionTimeoutMillis: 2000
    })

    try {
        await client.connect()
        await client.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = 'postgres'
              AND pid <> pg_backend_pid()
              AND usename = 'postgres'
        `)
    } catch {
        // The local database may already be stopped. supabase db reset starts it.
    } finally {
        await client.end().catch(() => undefined)
    }
}
