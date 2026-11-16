import pg from 'pg'
import { pathToFileURL } from 'node:url'
import type { LocalizedName } from '@findadoc/graphql'
import { NAME_PLAN_OUTCOME, planProfessionalNames, type NamePlanOutcome } from '../src/names/professionalNames.js'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'

/**
 * Two names per professional: romaji (en_US) and Japanese (ja_JP) (#282).
 *
 * For every professional a moderator has not confirmed, this removes names in other locales and
 * fills a missing romaji or Japanese name where `planProfessionalNames` can (kana to Hepburn,
 * romaji to katakana). A generated name, a name that could not be generated (kanji with no
 * reading), and a Japanese middle name merged into the first name all set
 * name_review = NEEDS_REVIEW for a moderator.
 *
 * Dry-run unless `--write` is passed. Reports counts and ids only, never a name.
 */

export type ProfessionalNamesReport = {
    write: boolean
    total: number
    byOutcome: Record<NamePlanOutcome, number>
    droppedLocaleNames: number
    mergedJapaneseMiddleNames: number
    toQueue: number
    sampleIdsToReview: string[]
    updated: number
}

type HpNameRow = {
    id: string
    names: LocalizedName[] | string | null
    name_review: string | null
}

const SAMPLE_SIZE = 5

const UNTOUCHED: ReadonlySet<NamePlanOutcome> = new Set([NAME_PLAN_OUTCOME.UNCHANGED, NAME_PLAN_OUTCOME.CONFIRMED])

function emptyOutcomeCounts(): Record<NamePlanOutcome, number> {
    return Object.fromEntries(Object.values(NAME_PLAN_OUTCOME).map(outcome => [outcome, 0])) as
        Record<NamePlanOutcome, number>
}

function isStoredName(value: unknown): value is LocalizedName {
    if (typeof value !== 'object' || value === null) {
        return false
    }
    const name = value as Record<string, unknown>
    return typeof name.firstName === 'string' && typeof name.lastName === 'string' && typeof name.locale === 'string'
        && (name.middleName === undefined || name.middleName === null || typeof name.middleName === 'string')
}

// jsonb arrives parsed from pg, but a string is parsed too in case a driver setting changes.
function rowNames(row: HpNameRow): LocalizedName[] {
    const value: unknown = typeof row.names === 'string' ? JSON.parse(row.names) : row.names
    return Array.isArray(value) ? value.filter(isStoredName) : []
}

/** Plans and, with `write`, applies the two-name rule on an open connection. */
export async function backfillProfessionalNames(
    client: pg.ClientBase,
    write: boolean
): Promise<ProfessionalNamesReport> {
    const rows = await client.query<HpNameRow>('select id, names, name_review from hps order by created_date, id')
    const report: ProfessionalNamesReport = {
        write,
        total: rows.rows.length,
        byOutcome: emptyOutcomeCounts(),
        droppedLocaleNames: 0,
        mergedJapaneseMiddleNames: 0,
        toQueue: 0,
        sampleIdsToReview: [],
        updated: 0
    }
    const changes: { id: string, names: LocalizedName[], nameReview: string | null }[] = []

    for (const row of rows.rows) {
        const plan = planProfessionalNames(rowNames(row), row.name_review)
        const queues = plan.nameReview !== row.name_review

        report.byOutcome[plan.outcome] += 1
        report.droppedLocaleNames += plan.droppedLocales
        report.mergedJapaneseMiddleNames += plan.mergedJapaneseMiddleName ? 1 : 0

        if (queues) {
            report.toQueue += 1
            if (report.sampleIdsToReview.length < SAMPLE_SIZE) {
                report.sampleIdsToReview.push(row.id)
            }
        }
        if (!UNTOUCHED.has(plan.outcome) || queues) {
            changes.push({ id: row.id, names: plan.names, nameReview: plan.nameReview })
        }
    }

    if (write && changes.length) {
        await client.query('begin')
        try {
            for (const change of changes) {
                // A moderator who confirms the names while this runs wins.
                const result = await client.query(`
                    update hps
                    set names = $2::jsonb, name_review = $3, updated_date = now()
                    where id = $1 and name_review is distinct from 'CONFIRMED'
                `, [change.id, JSON.stringify(change.names), change.nameReview])
                report.updated += result.rowCount ?? 0
            }
            await client.query('commit')
        } catch (error) {
            await client.query('rollback')
            throw error
        }
    }

    return report
}

export async function main(write = process.argv.includes('--write')): Promise<void> {
    assertScriptWriteAllowed(write)
    // eslint-disable-next-line no-console -- a CLI report of the target, like the other backfills
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    try {
        const report = await backfillProfessionalNames(client, write)
        // eslint-disable-next-line no-console -- counts and ids only
        console.log(JSON.stringify(report, null, 2))
        if (!write) {
            // eslint-disable-next-line no-console -- CLI hint for the operator
            console.log('Dry-run only. Re-run with --write to apply the two-name rule.')
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
        console.error(`backfillProfessionalNames failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
