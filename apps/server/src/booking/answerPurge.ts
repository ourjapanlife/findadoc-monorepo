import { sql, type ExpressionBuilder, type Kysely } from 'kysely'
import { db } from '../kyselyClient.js'
import type { Database } from '../typeDefs/kyselyTypes.js'
import { asJsonb } from '../../utils/dbUtils.js'
import { APPOINTMENT_STATUS } from './lifecycle.js'
import { answerRetentionDays } from './retention.js'

/**
 * Erasing a patient's booking answers (#212). One rule covers every answer: name,
 * contact details, date of birth, gender, visit reason, and insurance type. The row
 * stays with its id, clinic, form, locale, appointment, and timestamps, so a dispute
 * or a count still has a record, but no patient answers.
 *
 * Nothing here logs. Callers log counts only.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const CLOSED_STATUSES = [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.DECLINED]

type UpdateExecutor = Pick<Kysely<Database>, 'updateTable'>

/**
 * Empties one submission's answers and records when. Pass the transaction that
 * changes the appointment status, so a cancel or decline and the erase land together.
 */
export async function eraseSubmissionAnswers(executor: UpdateExecutor, bookingSubmissionId: string): Promise<void> {
    await executor.updateTable('booking_submissions')
        .set({ answers: asJsonb({}), answers_purged_at: sql`now()` })
        .where('id', '=', bookingSubmissionId)
        .where('answers_purged_at', 'is', null)
        .execute()
}

export type BookingAnswerPurgeResult = {
    // Submissions whose answers were due when the run started.
    answersDue: number
    answersErased: number
    // Cancel and decline notes cleared: the visit, or the cancel or decline, is past the period.
    reasonsCleared: number
    // Still due after the run. Always `answersDue` on a dry-run.
    answersOverdue: number
}

/**
 * Submissions that still hold answers and are past the rule: the visit ended the
 * retention period ago, whatever its status; the visit was cancelled or declined
 * (the status change erases these, so this catches rows from before #212); or there
 * is no appointment and the request was sent the retention period ago.
 */
function dueSubmissions(cutoffIso: string) {
    return db.selectFrom('booking_submissions as booking')
        .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')
        .where('booking.answers_purged_at', 'is', null)
        .where(eb => eb.or([
            eb('appointment.status', 'in', CLOSED_STATUSES),
            eb('appointment.ends_at', '<=', cutoffIso),
            eb.and([
                eb('appointment.id', 'is', null),
                eb('booking.created_date', '<=', cutoffIso)
            ])
        ]))
}

async function countDue(cutoffIso: string): Promise<number> {
    const row = await dueSubmissions(cutoffIso)
        .select(eb => eb.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow()
    return Number(row.count)
}

/**
 * Cancel and decline notes past the rule (#236). The note can be the patient's own words,
 * so it goes 90 days after the visit, like the answers. A cancel or decline keeps it 90
 * days after the status change, so staff can still read why; it is written in that call,
 * so that call does not clear it.
 */
function reasonPastRule(cutoffIso: string) {
    return (eb: ExpressionBuilder<Database, 'booking_appointments'>) => eb.and([
        eb('status_reason', 'is not', null),
        eb.or([
            eb('ends_at', '<=', cutoffIso),
            eb.and([
                eb('status', 'in', CLOSED_STATUSES),
                eb('status_changed_at', '<=', cutoffIso)
            ])
        ])
    ])
}

/** The cutoff the daily purge uses: the retention period before `now`. */
export function answerCutoff(now: Date): Date {
    return new Date(now.getTime() - answerRetentionDays() * DAY_MS)
}

/** The daily answer erase. Dry-run unless `write` is set. Returns counts only. */
export async function purgeExpiredBookingAnswers(options: {
    write: boolean
    now?: Date
}): Promise<BookingAnswerPurgeResult> {
    const cutoffIso = answerCutoff(options.now ?? new Date()).toISOString()
    const answersDue = await countDue(cutoffIso)

    if (!options.write) {
        const reasons = await db.selectFrom('booking_appointments')
            .select(eb => eb.fn.countAll<string>().as('count'))
            .where(reasonPastRule(cutoffIso))
            .executeTakeFirstOrThrow()
        return { answersDue, answersErased: 0, reasonsCleared: Number(reasons.count), answersOverdue: answersDue }
    }

    const erased = await db.updateTable('booking_submissions')
        .set({ answers: asJsonb({}), answers_purged_at: sql`now()` })
        .where('id', 'in', dueSubmissions(cutoffIso).select('booking.id'))
        .where('answers_purged_at', 'is', null)
        .executeTakeFirst()

    const cleared = await db.updateTable('booking_appointments')
        .set({ status_reason: null, status_reason_purged_at: sql`now()` })
        .where(reasonPastRule(cutoffIso))
        .executeTakeFirst()

    return {
        answersDue,
        answersErased: Number(erased.numUpdatedRows),
        reasonsCleared: Number(cleared.numUpdatedRows),
        answersOverdue: await countDue(cutoffIso)
    }
}
