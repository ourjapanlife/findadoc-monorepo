// Applies pending migrations from inside the VPC, where the private RDS database is reachable.
// CDK runs this function as a trigger during each deploy of the API stack, and a failure fails
// the deploy. It connects as the master user over TLS.
import pg from 'pg'
import { migrate } from '../scripts/db/migrations.js'

export const handler = async (): Promise<{ applied: string[] }> => {
    const client = new pg.Client({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT ?? 5432),
        database: 'postgres',
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        // TLS with a verified certificate. PGSSLMODE=disable is only for a local test run.
        ssl: process.env.PGSSLMODE === 'disable' ? undefined : { rejectUnauthorized: true },
        connectionTimeoutMillis: 10000
    })

    await client.connect()

    try {
        const applied = await migrate(client)

        return { applied: applied.map(file => `${file.version}_${file.name}`) }
    } finally {
        await client.end()
    }
}
