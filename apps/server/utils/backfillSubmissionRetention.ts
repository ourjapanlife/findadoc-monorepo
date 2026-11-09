import pg from 'pg'
import { pathToFileURL } from 'node:url'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'
import {
    DECIDED_NOTES_RETENTION_DAYS,
    UNDECIDED_NOTES_RETENTION_DAYS
} from '../src/submissions/notesRetention.js'
import { SUBMISSION_STATUS } from '../src/typeDefs/kyselyTypes.js'

/**
 * Set retain_until on submissions from before #236. A decided submission (approved or
 * rejected) gets 180 days after updated_date, the last time it changed. An undecided one gets
 * the submit-time cap, 365 days after created_date. Rows that already have retain_until are
 * left alone. The next daily purge clears notes on rows already past it.
 * Dry-run unless `--write` is passed. Reports counts only, never a note.
 */

type CountRow = { decided: string, undecided: string, past_with_notes: string }

// Bound as parameters: $1 approved, $2 rejected, $3 decided days, $4 undecided days.
const RETAIN_UNTIL = `
    case when status in ($1, $2)
        then updated_date + make_interval(days => $3::int)
        else created_date + make_interval(days => $4::int)
    end`

const PARAMETERS = [
    SUBMISSION_STATUS.APPROVED,
    SUBMISSION_STATUS.REJECTED,
    DECIDED_NOTES_RETENTION_DAYS,
    UNDECIDED_NOTES_RETENTION_DAYS
]

export async function main(write = process.argv.includes('--write')): Promise<void> {
    assertScriptWriteAllowed(write)
    // eslint-disable-next-line no-console -- a CLI report of the target, like the other backfills
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    try {
        const counts = await client.query<CountRow>(`
            select count(*) filter (where status in ($1, $2)) as decided,
                   count(*) filter (where status not in ($1, $2)) as undecided,
                   count(*) filter (where notes is not null and ${RETAIN_UNTIL} <= now()) as past_with_notes
            from submissions
            where retain_until is null
        `, PARAMETERS)
        const row = counts.rows[0]
        const report = {
            write,
            decided: Number(row?.decided ?? 0),
            undecided: Number(row?.undecided ?? 0),
            // Notes the next daily purge clears once this has run.
            pastWithNotes: Number(row?.past_with_notes ?? 0),
            updated: 0
        }

        if (write) {
            const result = await client.query(`
                update submissions
                set retain_until = ${RETAIN_UNTIL}
                where retain_until is null
            `, PARAMETERS)
            report.updated = result.rowCount ?? 0
        }

        // eslint-disable-next-line no-console -- counts only
        console.log(JSON.stringify(report, null, 2))
        if (!write && report.decided + report.undecided > 0) {
            // eslint-disable-next-line no-console -- CLI hint for the operator
            console.log('Dry-run only. Re-run with --write to set retain_until.')
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
        console.error(`backfillSubmissionRetention failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
