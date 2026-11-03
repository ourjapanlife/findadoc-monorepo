// Deletes booking uploads past retain_until, and clears the notes of decided corrections
// past retain_until, from inside the VPC. An EventBridge rule invokes it once a day (#159, #22).
// It connects as the API user with an IAM token.
//
// It logs one line of counts per purge. No upload id, object key, file name, note, or error
// message: an S3 error can repeat the key, the key holds the patient's file name, and a
// database error can repeat a note.
import { initializeLogger, logger } from './logger.js'
import { initializeKyselyClient } from './kyselyClient.js'
import { purgeExpiredBookingUploads, type BookingUploadPurgeResult } from '../utils/purgeExpiredBookingUploads.js'
import { purgeExpiredCorrectionNotes, type CorrectionNotesPurgeResult } from '../utils/purgeExpiredCorrectionNotes.js'

initializeLogger()
await initializeKyselyClient()

/** Runs separately from the booking purge, so one failing does not skip the other. */
async function purgeCorrectionNotes(): Promise<CorrectionNotesPurgeResult | null> {
    try {
        const result = await purgeExpiredCorrectionNotes({ write: true })
        logger.info('correction notes purge', { type: 'correctionNotesPurge', ...result })
        return result
    } catch (error) {
        logger.error('correction notes purge failed', {
            type: 'correctionNotesPurge',
            errorName: error instanceof Error ? error.name : 'unknown'
        })
        return null
    }
}

export const handler = async (): Promise<BookingUploadPurgeResult> => {
    let result: BookingUploadPurgeResult

    const corrections = await purgeCorrectionNotes()

    try {
        result = await purgeExpiredBookingUploads({ write: true })
    } catch (error) {
        logger.error('booking purge failed', {
            type: 'bookingPurge',
            errorName: error instanceof Error ? error.name : 'unknown'
        })
        throw new Error('Booking upload purge failed')
    }

    logger.info('booking purge', { type: 'bookingPurge', ...result })

    // A failed run, or an upload still past retain_until, counts as a Lambda error,
    // which is what the findadoc-booking-purge-failed alarm watches.
    if (result.failed > 0 || result.overdue > 0) {
        throw new Error(`Booking upload purge left ${result.overdue} overdue and ${result.failed} failed`)
    }
    if (corrections === null) {
        throw new Error('Correction notes purge failed')
    }

    return result
}
