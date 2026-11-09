import * as gqlTypes from '@findadoc/graphql'
import { sql, type ExpressionBuilder } from 'kysely'
import { db } from '../kyselyClient.js'
import type { Database } from '../typeDefs/kyselyTypes.js'

/**
 * Clearing submission notes (#236). Notes are free text that can hold personal data
 * (notesRetention.ts). Once retain_until has passed, the daily purge sets notes to null.
 * The status, the facility and professional fields, and the dates stay.
 *
 * audit_logs is never purged, so a submission's audit entries carry no notes. New entries
 * leave them out (submissionAuditValue); this purge removes the key from entries written
 * before that. It runs here, as the API user, because the production operator role may not
 * touch audit_logs. Once old entries are clean, that step finds nothing.
 *
 * Nothing here logs. Callers log counts only.
 */

const NOTES_KEY = 'notes'

type AuditValueColumn = 'new_value' | 'old_value'

export type SubmissionNotesPurgeResult = {
    // Submissions past retain_until that still had notes when the run started.
    notesDue: number
    notesCleared: number
    // Submission audit entries that still held notes when the run started.
    auditEntriesDue: number
    auditEntriesCleared: number
}

function expiredNotes(nowIso: string) {
    return (eb: ExpressionBuilder<Database, 'submissions'>) => eb.and([
        eb('notes', 'is not', null),
        eb('retain_until', 'is not', null),
        eb('retain_until', '<=', nowIso)
    ])
}

function auditValueHasNotes(column: AuditValueColumn) {
    return sql<boolean>`${sql.ref(column)} ? ${NOTES_KEY}::text`
}

function auditEntriesWithNotes(eb: ExpressionBuilder<Database, 'audit_logs'>) {
    return eb.and([
        eb('object_type', '=', gqlTypes.ObjectType.Submission),
        eb.or([auditValueHasNotes('new_value'), auditValueHasNotes('old_value')])
    ])
}

async function countRows(table: 'submissions' | 'audit_logs', nowIso: string): Promise<number> {
    const row = table === 'submissions'
        ? await db.selectFrom('submissions')
            .select(eb => eb.fn.countAll<string>().as('count'))
            .where(expiredNotes(nowIso))
            .executeTakeFirstOrThrow()
        : await db.selectFrom('audit_logs')
            .select(eb => eb.fn.countAll<string>().as('count'))
            .where(auditEntriesWithNotes)
            .executeTakeFirstOrThrow()
    return Number(row.count)
}

/** Removes the notes key from one audit column of submission entries. */
async function stripAuditNotes(column: AuditValueColumn): Promise<void> {
    await db.updateTable('audit_logs')
        .set({ [column]: sql<string>`${sql.ref(column)} - ${NOTES_KEY}::text` })
        .where('object_type', '=', gqlTypes.ObjectType.Submission)
        .where(auditValueHasNotes(column))
        .execute()
}

/** The daily submission notes purge. Dry-run unless `write` is set. Returns counts only. */
export async function purgeExpiredSubmissionNotes(options: {
    write: boolean
    now?: Date
}): Promise<SubmissionNotesPurgeResult> {
    const nowIso = (options.now ?? new Date()).toISOString()
    const notesDue = await countRows('submissions', nowIso)
    const auditEntriesDue = await countRows('audit_logs', nowIso)

    if (!options.write) {
        return { notesDue, notesCleared: 0, auditEntriesDue, auditEntriesCleared: 0 }
    }

    const cleared = await db.updateTable('submissions')
        .set({ notes: null })
        .where(expiredNotes(nowIso))
        .executeTakeFirst()

    await stripAuditNotes('new_value')
    await stripAuditNotes('old_value')

    // One entry can hold notes in both columns; count it once.
    const auditEntriesCleared = auditEntriesDue - await countRows('audit_logs', nowIso)
    return {
        notesDue,
        notesCleared: Number(cleared.numUpdatedRows),
        auditEntriesDue,
        auditEntriesCleared
    }
}
