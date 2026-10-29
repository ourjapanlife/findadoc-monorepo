import { sql } from 'kysely'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'
import { deleteBookingObject } from '../storage/objectStorage.js'

/**
 * Deleting one booking upload's file. The row stays as the record that a file was
 * sent: purged_at is set, object_key becomes the marker `purged/{id}`, and the
 * patient's file name, which can identify them, is cleared.
 */
export async function purgeBookingUpload(upload: { id: string, object_key: string }, nowIso: string): Promise<void> {
    await deleteBookingObject(upload.object_key)
    await db.updateTable('booking_uploads')
        .set({
            purged_at: nowIso,
            object_key: `purged/${upload.id}`,
            file_name: ''
        })
        .where('id', '=', upload.id)
        .where('purged_at', 'is', null)
        .execute()
}

/**
 * A cancelled or declined visit no longer needs the patient's files (APPI: keep
 * personal data only as long as the purpose needs it). retain_until moves to now
 * first, so a file this run cannot delete is the daily purge's next job, then
 * each file is deleted. Logs counts only.
 */
export async function purgeSubmissionUploads(bookingSubmissionId: string): Promise<{ purged: number, failed: number }> {
    const now = new Date()
    const nowIso = now.toISOString()
    const uploads = await db.updateTable('booking_uploads')
        .set({ retain_until: sql`LEAST(COALESCE(retain_until, now()), now())` })
        .where('booking_submission_id', '=', bookingSubmissionId)
        .where('purged_at', 'is', null)
        .returning(['id', 'object_key'])
        .execute()

    let purged = 0
    let failed = 0
    for (const upload of uploads) {
        try {
            await purgeBookingUpload(upload, nowIso)
            purged += 1
        } catch {
            failed += 1
        }
    }
    if (uploads.length > 0) {
        logger.info('booking uploads purged after the visit closed', { type: 'bookingPurgeOnClose', purged, failed })
    }
    return { purged, failed }
}
