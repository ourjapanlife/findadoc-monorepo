// Deletes booking uploads past retain_until, erases booking answers and cancel notes past
// the answer retention rule (#212, #236), and clears submission notes past retain_until
// (#236), from inside the VPC. An EventBridge rule invokes it once a day (#159). It
// connects as the API user with an IAM token.
//
// It logs one line of counts per purge. No upload id, object key, file name, answer, note,
// or error message: an S3 error can repeat the key, the key holds the patient's file name,
// and a database error can repeat a note.
import { initializeLogger, logger } from './logger.js'
import { initializeKyselyClient } from './kyselyClient.js'
import { purgeExpiredBookingAnswers, type BookingAnswerPurgeResult } from './booking/answerPurge.js'
import { purgeExpiredSubmissionNotes, type SubmissionNotesPurgeResult } from './submissions/notesPurge.js'
import { purgeExpiredBookingUploads, type BookingUploadPurgeResult } from '../utils/purgeExpiredBookingUploads.js'

initializeLogger()
await initializeKyselyClient()

type BookingPurgeResult = BookingUploadPurgeResult & BookingAnswerPurgeResult

/** Runs apart from the booking purge, so one failing does not skip the other. */
async function purgeSubmissionNotes(): Promise<SubmissionNotesPurgeResult | null> {
    try {
        const result = await purgeExpiredSubmissionNotes({ write: true })
        logger.info('submission notes purge', { type: 'submissionNotesPurge', ...result })
        return result
    } catch (error) {
        logger.error('submission notes purge failed', {
            type: 'submissionNotesPurge',
            errorName: error instanceof Error ? error.name : 'unknown'
        })
        return null
    }
}

export const handler = async (): Promise<BookingPurgeResult> => {
    let result: BookingPurgeResult

    const notes = await purgeSubmissionNotes()

    try {
        const uploads = await purgeExpiredBookingUploads({ write: true })
        const answers = await purgeExpiredBookingAnswers({ write: true })
        result = { ...uploads, ...answers }
    } catch (error) {
        logger.error('booking purge failed', {
            type: 'bookingPurge',
            errorName: error instanceof Error ? error.name : 'unknown'
        })
        throw new Error('Booking purge failed')
    }

    logger.info('booking purge', { type: 'bookingPurge', ...result })

    // A failed run, or an upload or answer still past its rule, counts as a Lambda error,
    // which is what the findadoc-booking-purge-failed alarm watches.
    if (result.failed > 0 || result.overdue > 0 || result.answersOverdue > 0) {
        const overdue = `${result.overdue} uploads and ${result.answersOverdue} answers overdue`
        throw new Error(`Booking purge left ${overdue}, and ${result.failed} failed`)
    }
    if (notes === null) {
        throw new Error('Submission notes purge failed')
    }

    return result
}
