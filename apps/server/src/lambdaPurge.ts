// Deletes booking uploads past retain_until, from inside the VPC. An EventBridge rule
// invokes it once a day (#159). It connects as the API user with an IAM token.
//
// It logs one line of counts. No upload id, object key, file name, or error message:
// an S3 error can repeat the key, and the key holds the patient's file name.
import { initializeLogger, logger } from './logger.js'
import { initializeKyselyClient } from './kyselyClient.js'
import { purgeExpiredBookingUploads, type BookingUploadPurgeResult } from '../utils/purgeExpiredBookingUploads.js'

initializeLogger()
await initializeKyselyClient()

export const handler = async (): Promise<BookingUploadPurgeResult> => {
    let result: BookingUploadPurgeResult

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

    return result
}
