import { SUBMISSION_STATUS, type SubmissionStatusEnum } from '../typeDefs/kyselyTypes.js'

/**
 * Retention for submission notes (#236). Notes are free text: a signed-out visitor types
 * them on the public form, and a moderator edits the same column. Either can hold a name,
 * a phone number, or health details, so one rule covers both and every submission.
 *
 * retain_until is set on submit, moved on every decision, and moved back on a reopen. The
 * daily purge (notesPurge.ts) clears notes once retain_until has passed.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Days notes stay on a submission nobody has approved or declined. */
export const UNDECIDED_NOTES_RETENTION_DAYS = 365

/** Days notes stay after a moderator approves or declines the submission. */
export const DECIDED_NOTES_RETENTION_DAYS = 180

/** True for approved and rejected: the statuses that start the 180-day clock. */
export function isDecidedSubmissionStatus(status: SubmissionStatusEnum): boolean {
    return status === SUBMISSION_STATUS.APPROVED || status === SUBMISSION_STATUS.REJECTED
}

/**
 * When a submission's notes are cleared. A decided submission keeps them 180 days from
 * `decidedAt`. An undecided one, including one a moderator reopens, keeps them 365 days
 * from when it was sent, so a submission nobody decides is covered too.
 */
export function submissionRetainUntil(
    status: SubmissionStatusEnum,
    createdDate: string,
    decidedAt: Date = new Date()
): string {
    if (isDecidedSubmissionStatus(status)) {
        return new Date(decidedAt.getTime() + DECIDED_NOTES_RETENTION_DAYS * DAY_MS).toISOString()
    }
    return new Date(new Date(createdDate).getTime() + UNDECIDED_NOTES_RETENTION_DAYS * DAY_MS).toISOString()
}
