import { pathToFileURL } from 'node:url'
import { db } from '../src/kyselyClient.js'
import { logger } from '../src/logger.js'
import { deleteBookingObject } from '../src/storage/objectStorage.js'

/**
 * Delete booking upload objects whose retain_until has passed.
 * Identity documents (insurance / My Number photos) default to 30 days.
 * Dry-run unless `--write` is passed. Does not delete answer rows.
 */

type ExpiredUpload = {
    id: string
    object_key: string
    sensitivity: string
    retain_until: string | null
}

async function listExpiredUploads(nowIso: string): Promise<ExpiredUpload[]> {
    return db.selectFrom('booking_uploads')
        .select(['id', 'object_key', 'sensitivity', 'retain_until'])
        .where('purged_at', 'is', null)
        .where('retain_until', 'is not', null)
        .where('retain_until', '<=', nowIso)
        .orderBy('retain_until')
        .execute()
}

export async function purgeExpiredBookingUploads(options: {
    write: boolean
    now?: Date
}): Promise<{ scanned: number, purged: number }> {
    const nowIso = (options.now ?? new Date()).toISOString()
    const expired = await listExpiredUploads(nowIso)
    let purged = 0

    for (const upload of expired) {
        logger.info(
            `Booking upload ${upload.id} (${upload.sensitivity}) retain_until=${upload.retain_until}`
            + (options.write ? ' — purging' : ' — dry-run')
        )
        if (!options.write) {
            continue
        }
        await deleteBookingObject(upload.object_key)
        await db.updateTable('booking_uploads')
            .set({
                purged_at: nowIso,
                object_key: `purged/${upload.id}`
            })
            .where('id', '=', upload.id)
            .where('purged_at', 'is', null)
            .execute()
        purged += 1
    }

    return { scanned: expired.length, purged }
}

async function main(): Promise<void> {
    const write = process.argv.includes('--write')
    const result = await purgeExpiredBookingUploads({ write })
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ write, ...result }, null, 2))
    if (!write && result.scanned > 0) {
        // eslint-disable-next-line no-console
        console.log('Dry-run only. Re-run with --write to delete objects and mark rows purged.')
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        logger.error(`purgeExpiredBookingUploads failed: ${String(error)}`)
        process.exitCode = 1
    })
}
