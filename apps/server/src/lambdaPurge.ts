// Deletes booking uploads past retain_until, and erases booking answers past the
// answer retention rule (#212), from inside the VPC. An EventBridge rule invokes it
// once a day (#159). It connects as the API user with an IAM token.
//
// It logs one line of counts. No upload id, object key, file name, answer, or error
// message: an S3 error can repeat the key, and the key holds the patient's file name.
import { initializeLogger, logger } from './logger.js'
import { initializeKyselyClient } from './kyselyClient.js'
import { purgeExpiredBookingAnswers, type BookingAnswerPurgeResult } from './booking/answerPurge.js'
import { purgeExpiredBookingUploads, type BookingUploadPurgeResult } from '../utils/purgeExpiredBookingUploads.js'

initializeLogger()
await initializeKyselyClient()

type BookingPurgeResult = BookingUploadPurgeResult & BookingAnswerPurgeResult

export const handler = async (): Promise<BookingPurgeResult> => {
    let result: BookingPurgeResult

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

    return result
}
