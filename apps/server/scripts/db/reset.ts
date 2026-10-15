import { spawnSync } from 'node:child_process'

const remoteFlags = ['--linked', '--db-url']
const remoteEnv = ['SUPABASE_DB_URL', 'DATABASE_URL', 'DB_URL', 'POSTGRES_URL', 'SUPABASE_DB_PASSWORD']

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

const result = spawnSync(
    'supabase',
    ['db', 'reset', '--local', '--no-seed', '--yes'],
    { stdio: 'inherit', env, shell: process.platform === 'win32' }
)

if (result.error) {
    console.error('The Supabase CLI is required to reset the local database.')
    process.exit(1)
}

process.exit(result.status ?? 1)
