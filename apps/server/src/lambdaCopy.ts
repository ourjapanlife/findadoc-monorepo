// One-off: copies the Supabase database into RDS from inside the VPC (#81). Run it by hand,
// first with dryRun, then for real at the cutover. Supabase's direct database host is
// IPv6-only, which the VPC reaches through the egress-only gateway.
//
// The event carries the Supabase connection string, so the password is never stored in AWS.
// The function never logs it. Pass it in a file, not on the command line:
//   aws lambda invoke --function-name findadoc-db-copy --cli-binary-format raw-in-base64-out \
//     --payload file://copy.json out.json
// where copy.json is {"sourceDatabaseUrl": "postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres", "dryRun": true}
import pg from 'pg'
import { compareDatabases, copyDatabase, type TableReport } from '../scripts/db/copyDatabase.js'

export type CopyEvent = {
    sourceDatabaseUrl?: string
    // Supabase's root certificate (Dashboard → Database → SSL). Without it, TLS is used unverified.
    sourceCaCert?: string
    dryRun?: boolean
}

export type CopyResult = {
    dryRun: boolean
    allMatch: boolean
    reports: TableReport[]
}

// sslmode in the URL would override the ssl settings below, so it is read and removed.
// Only sslmode=disable changes anything (a local test). Supabase always gets TLS.
function splitSslMode(url: string): { url: string, disableSsl: boolean } {
    const parsed = new URL(url)
    const disableSsl = parsed.searchParams.get('sslmode') === 'disable'

    parsed.searchParams.delete('sslmode')
    return { url: parsed.toString(), disableSsl }
}

export const handler = async (event: CopyEvent): Promise<CopyResult> => {
    if (!event?.sourceDatabaseUrl) {
        throw new Error('Pass sourceDatabaseUrl, the Supabase direct connection string, in the event.')
    }

    const dryRun = event.dryRun !== false
    const sourceUrl = splitSslMode(event.sourceDatabaseUrl)
    const sourceSsl = event.sourceCaCert
        ? { ca: event.sourceCaCert, rejectUnauthorized: true }
        : { rejectUnauthorized: false }
    const source = new pg.Client({
        connectionString: sourceUrl.url,
        ssl: sourceUrl.disableSsl ? undefined : sourceSsl,
        connectionTimeoutMillis: 15000
    })
    const target = new pg.Client({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT ?? 5432),
        database: 'postgres',
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: process.env.PGSSLMODE === 'disable' ? undefined : { rejectUnauthorized: true },
        connectionTimeoutMillis: 15000
    })

    if (!event.sourceCaCert && !sourceUrl.disableSsl) {
        // eslint-disable-next-line no-console
        console.warn('No sourceCaCert: the Supabase connection is encrypted but its certificate is not verified.')
    }

    await source.connect()
    await target.connect()

    try {
        const reports = dryRun
            ? await compareDatabases(source, target)
            : await copyDatabase(source, target)

        return { dryRun, allMatch: reports.every(report => report.matches), reports }
    } finally {
        await source.end().catch(() => undefined)
        await target.end().catch(() => undefined)
    }
}
