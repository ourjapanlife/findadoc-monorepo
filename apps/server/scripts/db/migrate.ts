import pg from 'pg'
import { envVariables } from '../../utils/environmentVariables.js'
import { migrate } from './migrations.js'

// Local default: the Docker database from `pnpm db:start`.
const localDatabaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const dryRun = process.argv.includes('--dry-run')
const databaseUrl = envVariables.dbUrl()

// A production run never falls back to the local database. It needs an explicit target.
if (envVariables.isProduction() && !databaseUrl) {
    console.error('Set DATABASE_URL to the database to migrate. Use a direct or session connection, not a transaction pooler.')
    process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl ?? localDatabaseUrl })

try {
    await client.connect()
    const applied = await migrate(client, { dryRun })

    console.log(dryRun
        ? `${applied.length} migration(s) would run.`
        : `${applied.length} migration(s) applied.`)
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
} finally {
    await client.end()
}
