import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { Specialty } from '@findadoc/graphql'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'

/**
 * Merge ENT_SPECIALIST into OTOLARYNGOLOGY on every professional (#277).
 *
 * Both values named the same department, 耳鼻咽喉科, and pickers listed them side by side. The
 * specialty vocabulary keeps OTOLARYNGOLOGY and hides ENT_SPECIALIST, so this moves the stored rows.
 * A professional who had both keeps one OTOLARYNGOLOGY, in the place ENT_SPECIALIST or
 * OTOLARYNGOLOGY first appeared. Other specialties are not touched.
 *
 * Dry-run unless `--write` is passed. Reports counts and ids only.
 */

export type EntSpecialtyReport = {
    write: boolean
    toMerge: number
    sampleIds: string[]
    updated: number
}

const SAMPLE_SIZE = 5

/** The specialties with ENT_SPECIALIST replaced by one OTOLARYNGOLOGY, keeping the order. */
export function mergedSpecialties(specialties: readonly string[]): string[] {
    const merged: string[] = []
    for (const specialty of specialties) {
        const value = specialty === Specialty.EntSpecialist ? Specialty.Otolaryngology : specialty
        if (!merged.includes(value)) {
            merged.push(value)
        }
    }
    return merged
}

type Row = { id: string, specialties: string[] }

/** Plans and, with `write`, applies the merge on an open connection. */
export async function backfillEntSpecialty(client: pg.ClientBase, write: boolean): Promise<EntSpecialtyReport> {
    const result = await client.query<Row>(`
        select id, specialties from hps where specialties ? $1 order by created_date
    `, [Specialty.EntSpecialist])

    const report: EntSpecialtyReport = {
        write,
        toMerge: result.rows.length,
        sampleIds: result.rows.slice(0, SAMPLE_SIZE).map(row => row.id),
        updated: 0
    }

    if (write && result.rows.length > 0) {
        await client.query('begin')
        try {
            for (const row of result.rows) {
                // Compare-and-set: a row a moderator already changed keeps that change.
                const update = await client.query(`
                    update hps set specialties = $1::jsonb, updated_date = now()
                    where id = $2 and specialties = $3::jsonb
                `, [JSON.stringify(mergedSpecialties(row.specialties)), row.id, JSON.stringify(row.specialties)])
                report.updated += update.rowCount ?? 0
            }
            await client.query('commit')
        } catch (error) {
            await client.query('rollback')
            throw error
        }
    }

    return report
}

export async function main(argv: readonly string[] = process.argv): Promise<void> {
    const write = argv.includes('--write')
    assertScriptWriteAllowed(write, argv)
    // eslint-disable-next-line no-console -- a CLI report of the target, like the other backfills
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    try {
        const report = await backfillEntSpecialty(client, write)
        // eslint-disable-next-line no-console -- counts and ids only
        console.log(JSON.stringify(report, null, 2))
        if (!write && report.toMerge > 0) {
            // eslint-disable-next-line no-console -- CLI hint for the operator
            console.log('Dry-run only. Re-run with --write to merge ENT_SPECIALIST into OTOLARYNGOLOGY.')
        }
    } finally {
        await client.end()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        // eslint-disable-next-line no-console -- the error name only; a database error can repeat row values
        console.error(`backfillEntSpecialty failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
