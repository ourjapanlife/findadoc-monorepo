import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { compareDatabases, copyDatabase } from '../scripts/db/copyDatabase.js'
import { migrate } from '../scripts/db/migrations.js'
import { localDatabaseConfig } from '../utils/localDatabase.js'

// The source is a frozen copy of the local test database. The other test files keep writing to
// that database while this one runs, so comparing against it directly races them. The target
// is a scratch database built from the same migrations, as RDS is before the real copy.
// PGHOST and PGPORT choose the local database, as they do for the API.
const { host, port, user, password } = localDatabaseConfig()
const local = { host, port, user, password }
const sourceName = 'findadoc_copy_test_source'
const targetName = 'findadoc_copy_test'

const connect = async (database: string) => {
    const client = new pg.Client({ ...local, database })

    await client.connect()
    return client
}

let admin: pg.Client
let source: pg.Client
let target: pg.Client

beforeAll(async () => {
    admin = await connect('postgres')
    for (const name of [sourceName, targetName]) {
        await admin.query(`DROP DATABASE IF EXISTS ${name}`)
        await admin.query(`CREATE DATABASE ${name}`)
    }

    source = await connect(sourceName)
    await migrate(source, { importSupabaseHistory: false, log: () => undefined })
    const live = await connect('postgres')
    try {
        await copyDatabase(live, source, { log: () => undefined })
    } finally {
        await live.end()
    }

    target = await connect(targetName)
    await migrate(target, { importSupabaseHistory: false, log: () => undefined })
    // Like Supabase's production database: the same generated column, built by a different expression.
    await target.query('ALTER TABLE facilities DROP COLUMN search_text')
    await target.query('ALTER TABLE facilities ADD COLUMN search_text text GENERATED ALWAYS AS (lower(name_en)) STORED')
}, 120_000)

afterAll(async () => {
    await source?.end()
    await target?.end()
    await admin.query(`DROP DATABASE IF EXISTS ${sourceName}`)
    await admin.query(`DROP DATABASE IF EXISTS ${targetName}`)
    await admin.end()
})

describe('copyDatabase', () => {
    it('reports the differences before a copy, without writing', async () => {
        const reports = await compareDatabases(source, target)

        expect(reports.map(report => report.table)).not.toContain('schema_migrations')
        expect(reports.find(report => report.table === 'facilities')?.matches).toBe(false)
    })

    it('copies every table so each one matches the source by count and content', async () => {
        const reports = await copyDatabase(source, target, { log: () => undefined })
        const facilities = reports.find(report => report.table === 'facilities')

        expect(reports.every(report => report.matches)).toBe(true)
        expect(facilities?.sourceRows).toBeGreaterThan(0)
        expect(facilities?.targetRows).toBe(facilities?.sourceRows)
        // Parents load before the tables that reference them.
        const order = reports.map(report => report.table)
        expect(order.indexOf('facilities')).toBeLessThan(order.indexOf('hps_facilities'))
        expect(order.indexOf('cities')).toBeLessThan(order.indexOf('facilities'))
    }, 60_000)

    it('matches when only a generated column is built differently, and reports that column', async () => {
        const reports = await compareDatabases(source, target)
        const facilities = reports.find(report => report.table === 'facilities')

        expect(reports.every(report => report.matches)).toBe(true)
        expect(facilities?.generatedColumns).toEqual(['search_text'])
    })

    it('recomputes generated columns with the target\'s own expression and keeps its migration history', async () => {
        const { rows: [row] } = await target.query<{ ok: boolean }>(
            'SELECT bool_and(search_text = lower(name_en)) AS ok FROM facilities'
        )
        const { rows: [history] } = await target.query<{ count: number }>('SELECT count(*)::int AS count FROM schema_migrations')

        expect(row.ok).toBe(true)
        expect(history.count).toBeGreaterThan(0)
    })

    it('notices a single changed value', async () => {
        await target.query('UPDATE facilities SET name_en = name_en || \' changed\' WHERE id = (SELECT id FROM facilities LIMIT 1)')

        const reports = await compareDatabases(source, target)
        const different = reports.filter(report => !report.matches)

        expect(different.map(report => report.table)).toEqual(['facilities'])
        expect(different[0].differingColumns).toEqual(['name_en'])
    })
})

describe('copy Lambda handler', () => {
    it('only compares unless dryRun is false, and needs a source', async () => {
        const { handler } = await import('../src/lambdaCopy.js')

        Object.assign(process.env, {
            PGHOST: local.host,
            PGPORT: String(local.port),
            PGUSER: local.user,
            PGPASSWORD: local.password,
            PGSSLMODE: 'disable'
        })

        // The handler targets the "postgres" database, so point the source at the scratch one.
        const sourceDatabaseUrl = `postgresql://${local.user}:${local.password}@${local.host}:${local.port}/${targetName}?sslmode=disable`
        const compared = await handler({ sourceDatabaseUrl })

        expect(compared.dryRun).toBe(true)
        expect(compared.reports.length).toBeGreaterThan(5)
        await expect(handler({} as never)).rejects.toThrow('sourceDatabaseUrl')
    })
})
