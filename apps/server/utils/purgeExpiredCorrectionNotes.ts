import { pathToFileURL } from 'node:url'
import type { ExpressionBuilder } from 'kysely'
import { closeDatabase, db, initializeKyselyClient } from '../src/kyselyClient.js'
import { initializeLogger } from '../src/logger.js'
import { SUBMISSION_KIND, type Database } from '../src/typeDefs/kyselyTypes.js'

/**
 * Clear the notes of corrections decided more than 180 days ago (#22).
 * A moderator's approve or decline sets retain_until (corrections/facilityCorrection.ts).
 * Notes are a visitor's free text and can hold personal data, so they do not outlive it.
 * Reason codes, changed fields, and status stay: they are not personal data.
 * Dry-run unless `--write` is passed. Reports counts only.
 */

export type CorrectionNotesPurgeResult = {
    // Decided corrections past retain_until that still had notes when the run started.
    scanned: number
    purged: number
}

function expiredNotes(nowIso: string) {
    return (eb: ExpressionBuilder<Database, 'submissions'>) => eb.and([
        eb('kind', '=', SUBMISSION_KIND.CORRECTION),
        eb('notes', 'is not', null),
        eb('retain_until', 'is not', null),
        eb('retain_until', '<=', nowIso)
    ])
}

export async function purgeExpiredCorrectionNotes(options: {
    write: boolean
    now?: Date
}): Promise<CorrectionNotesPurgeResult> {
    const nowIso = (options.now ?? new Date()).toISOString()
    const { count } = await db.selectFrom('submissions')
        .select(eb => eb.fn.countAll<string>().as('count'))
        .where(expiredNotes(nowIso))
        .executeTakeFirstOrThrow()
    const scanned = Number(count)

    if (!options.write || scanned === 0) {
        return { scanned, purged: 0 }
    }

    const result = await db.updateTable('submissions')
        .set({ notes: null })
        .where(expiredNotes(nowIso))
        .executeTakeFirst()

    return { scanned, purged: Number(result.numUpdatedRows) }
}

async function main(): Promise<void> {
    const write = process.argv.includes('--write')

    initializeLogger()
    await initializeKyselyClient()

    try {
        const result = await purgeExpiredCorrectionNotes({ write })
        // eslint-disable-next-line no-console -- a CLI report of counts, like purgeExpiredBookingUploads
        console.log(JSON.stringify({ write, ...result }, null, 2))
        if (!write && result.scanned > 0) {
            // eslint-disable-next-line no-console -- CLI hint for the operator
            console.log('Dry-run only. Re-run with --write to clear these notes.')
        }
    } finally {
        await closeDatabase()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        // eslint-disable-next-line no-console -- the error name only; a database error can repeat row values
        console.error(`purgeExpiredCorrectionNotes failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
