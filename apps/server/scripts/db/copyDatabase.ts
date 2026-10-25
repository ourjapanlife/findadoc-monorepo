import { pipeline } from 'node:stream/promises'
import type pg from 'pg'
import { from as copyFrom, to as copyTo } from 'pg-copy-streams'

// Tables the copy leaves alone: each database keeps its own migration history.
const SKIPPED_TABLES = new Set(['schema_migrations'])

export type TableReport = {
    table: string
    sourceRows: number
    targetRows: number
    matches: boolean
    // Copied columns whose values differ, when the table does not match.
    differingColumns?: string[]
    // Columns each database computes itself, so they are neither copied nor compared.
    generatedColumns?: string[]
}

export type CopyOptions = {
    log?: (line: string) => void
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`

/** Every public table except the skipped ones, parents before the tables that reference them. */
async function tablesInLoadOrder(client: pg.Client): Promise<string[]> {
    const { rows: tables } = await client.query<{ name: string }>(`
        SELECT c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
    `)
    const { rows: references } = await client.query<{ child: string, parent: string }>(`
        SELECT child.relname AS child, parent.relname AS parent
        FROM pg_constraint con
        JOIN pg_class child ON child.oid = con.conrelid
        JOIN pg_class parent ON parent.oid = con.confrelid
        JOIN pg_namespace n ON n.oid = child.relnamespace
        WHERE con.contype = 'f' AND n.nspname = 'public' AND child.oid <> parent.oid
    `)

    const names = tables.map(table => table.name).filter(name => !SKIPPED_TABLES.has(name))
    const parents = new Map(names.map(name => [name, new Set<string>()]))

    for (const { child, parent } of references) {
        parents.get(child)?.add(parent)
    }

    const ordered: string[] = []
    const placed = new Set<string>()

    while (ordered.length < names.length) {
        const ready = names.filter(name => !placed.has(name)
            && [...(parents.get(name) ?? [])].every(parent => placed.has(parent) || !parents.has(parent)))

        if (!ready.length) {
            throw new Error('The public tables reference each other in a cycle, so there is no load order.')
        }

        for (const name of ready) {
            ordered.push(name)
            placed.add(name)
        }
    }

    return ordered
}

async function columns(client: pg.Client, table: string, insertableOnly: boolean): Promise<string[]> {
    const { rows } = await client.query<{ name: string }>(`
        SELECT a.attname AS name
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass($1) AND a.attnum > 0 AND NOT a.attisdropped
          ${insertableOnly ? "AND a.attgenerated = ''" : ''}
        ORDER BY a.attname
    `, [`public.${ident(table)}`])

    return rows.map(row => row.name)
}

// Sorting uses the C collation: the two databases can have different locales, and identical
// rows in a different order would hash differently.

/**
 * Row count and an MD5 over every row's given columns, sorted by column name, so two databases
 * whose columns were added in a different physical order still compare equal.
 */
async function fingerprint(client: pg.Client, table: string, columnNames: string[]): Promise<{ rows: number, hash: string }> {
    const rowText = `ROW(${columnNames.map(name => `t.${ident(name)}`).join(', ')})::text COLLATE "C"`
    const { rows: [result] } = await client.query<{ rows: number, hash: string }>(`
        SELECT count(*)::int AS rows,
               coalesce(md5(string_agg(${rowText}, E'\\n' ORDER BY ${rowText})), '') AS hash
        FROM public.${ident(table)} t
    `)

    return result
}

// One MD5 per column over its values, to name the columns behind a mismatch.
async function columnHashes(client: pg.Client, table: string, columnNames: string[]): Promise<Map<string, string>> {
    const hashes = new Map<string, string>()

    for (const name of columnNames) {
        const value = `t.${ident(name)}::text COLLATE "C"`
        const { rows: [result] } = await client.query<{ hash: string }>(`
            SELECT coalesce(md5(string_agg(coalesce(${value}, '<null>'), E'\n' ORDER BY ${value})), '') AS hash
            FROM public.${ident(table)} t
        `)

        hashes.set(name, result.hash)
    }

    return hashes
}

async function sameTables(source: pg.Client, target: pg.Client): Promise<string[]> {
    const [sourceTables, targetTables] = await Promise.all([tablesInLoadOrder(source), tablesInLoadOrder(target)])
    const missing = sourceTables.filter(table => !targetTables.includes(table))
    const extra = targetTables.filter(table => !sourceTables.includes(table))

    if (missing.length || extra.length) {
        throw new Error(`The two databases have different tables. Missing on the target: [${missing.join(', ')}]. `
            + `Only on the target: [${extra.join(', ')}]. Apply the same migrations to both first.`)
    }

    for (const table of sourceTables) {
        const [sourceColumns, targetColumns] = await Promise.all([columns(source, table, false), columns(target, table, false)])

        if (sourceColumns.join(',') !== targetColumns.join(',')) {
            throw new Error(`${table} has different columns: source [${sourceColumns.join(', ')}], target [${targetColumns.join(', ')}].`)
        }
    }

    return sourceTables
}

/**
 * Compares every table on both sides by row count and the content of the columns the copy
 * writes. Generated columns are left out: each database computes them from its own
 * definition, which can differ (Supabase's production search_text did) while every copied
 * value is identical. Writes nothing.
 */
export async function compareDatabases(source: pg.Client, target: pg.Client): Promise<TableReport[]> {
    await source.query('SET TIME ZONE \'UTC\'')
    await target.query('SET TIME ZONE \'UTC\'')

    const tables = await sameTables(source, target)
    const reports: TableReport[] = []

    for (const table of tables) {
        const copied = await columns(source, table, true)
        const generated = (await columns(source, table, false)).filter(name => !copied.includes(name))
        const [fromSource, fromTarget] = await Promise.all([
            fingerprint(source, table, copied),
            fingerprint(target, table, copied)
        ])
        const matches = fromSource.rows === fromTarget.rows && fromSource.hash === fromTarget.hash
        const report: TableReport = { table, sourceRows: fromSource.rows, targetRows: fromTarget.rows, matches }

        if (generated.length) {
            report.generatedColumns = generated
        }

        if (!matches) {
            const [sourceColumns, targetColumns] = await Promise.all([
                columnHashes(source, table, copied),
                columnHashes(target, table, copied)
            ])

            report.differingColumns = copied.filter(name => sourceColumns.get(name) !== targetColumns.get(name))
        }

        reports.push(report)
    }

    return reports
}

/**
 * Replaces every public table on the target with the source's rows, in one target transaction.
 * The source is read from a single REPEATABLE READ snapshot. Generated columns are left for the
 * target to compute. Before committing, every table is compared by row count and content, and any
 * difference rolls the whole copy back. The target's migration history is not touched.
 */
export async function copyDatabase(source: pg.Client, target: pg.Client, options: CopyOptions = {}): Promise<TableReport[]> {
    const log = options.log ?? (line => console.log(line))

    await source.query('SET TIME ZONE \'UTC\'')
    await target.query('SET TIME ZONE \'UTC\'')
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await target.query('BEGIN')

    try {
        const tables = await sameTables(source, target)

        await target.query(`TRUNCATE ${tables.map(table => `public.${ident(table)}`).join(', ')}`)

        for (const table of tables) {
            const columnList = (await columns(source, table, true)).map(ident).join(', ')
            const reader = source.query(copyTo(`COPY (SELECT ${columnList} FROM public.${ident(table)}) TO STDOUT`))
            const writer = target.query(copyFrom(`COPY public.${ident(table)} (${columnList}) FROM STDIN`))

            await pipeline(reader, writer)
            log(`Copied ${table}`)
        }

        const reports = await compareDatabases(source, target)
        const different = reports.filter(report => !report.matches)

        if (different.length) {
            const details = different.map(report => `${report.table} (${report.differingColumns?.join(', ') || 'row count'})`)

            throw new Error(`The copy does not match the source for: ${details.join('; ')}. Nothing was changed.`)
        }

        await target.query('COMMIT')
        return reports
    } catch (error) {
        await target.query('ROLLBACK').catch(() => undefined)
        throw error
    } finally {
        await source.query('COMMIT').catch(() => undefined)
    }
}
