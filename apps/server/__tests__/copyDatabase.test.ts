import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { compareDatabases, copyDatabase } from '../scripts/db/copyDatabase.js'
import { migrate } from '../scripts/db/migrations.js'

// The local test database is the source. The target is a scratch database built from the
// same migrations, as RDS is before the real copy.
const local = { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres' }
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
    await admin.query(`DROP DATABASE IF EXISTS ${targetName}`)
    await admin.query(`CREATE DATABASE ${targetName}`)

    target = await connect(targetName)
    await migrate(target, { importSupabaseHistory: false, log: () => undefined })
    source = await connect('postgres')
}, 60_000)

afterAll(async () => {
    await source?.end()
    await target?.end()
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

    it('recomputes generated columns and keeps the target migration history', async () => {
        const { rows: [row] } = await target.query<{ ok: boolean }>(
            'SELECT bool_and(search_text = id::text || \' \' || name_en || \' \' || name_ja) AS ok FROM facilities'
        )
        const { rows: [history] } = await target.query<{ count: number }>('SELECT count(*)::int AS count FROM schema_migrations')

        expect(row.ok).toBe(true)
        expect(history.count).toBeGreaterThan(0)
    })

    it('notices a single changed value', async () => {
        await target.query('UPDATE facilities SET name_en = name_en || \' changed\' WHERE id = (SELECT id FROM facilities LIMIT 1)')

        const reports = await compareDatabases(source, target)

        expect(reports.filter(report => !report.matches).map(report => report.table)).toEqual(['facilities'])
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
