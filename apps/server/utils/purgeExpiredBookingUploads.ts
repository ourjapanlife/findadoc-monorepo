import { pathToFileURL } from 'node:url'
import { closeDatabase, db, initializeKyselyClient } from '../src/kyselyClient.js'
import { initializeLogger } from '../src/logger.js'
import { purgeBookingUpload } from '../src/booking/uploadPurge.js'
import { deleteBookingObject } from '../src/storage/objectStorage.js'

/**
 * Delete booking upload objects whose retain_until has passed.
 * Identity documents (insurance / My Number photos) default to 30 days.
 * Dry-run unless `--write` is passed. Does not delete answer rows.
 *
 * Reports counts only. An object key holds the patient's file name, and an S3
 * error message can repeat the key, so neither is logged.
 */

const UNCLAIMED_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type BookingUploadPurgeResult = {
    // Past retain_until and not yet purged when the run started.
    scanned: number
    purged: number
    // Never attached to a submission, older than one day.
    unclaimed: number
    unclaimedDeleted: number
    // Uploads whose object or row could not be removed in this run.
    failed: number
    // Still past retain_until and not purged after the run. Always `scanned` on a dry-run.
    overdue: number
}

async function listExpiredUploads(nowIso: string): Promise<Array<{ id: string, object_key: string }>> {
    return db.selectFrom('booking_uploads')
        .select(['id', 'object_key'])
        .where('purged_at', 'is', null)
        .where('retain_until', 'is not', null)
        .where('retain_until', '<=', nowIso)
        .orderBy('retain_until')
        .execute()
}

async function listUnclaimedUploads(cutoffIso: string): Promise<Array<{ id: string, object_key: string }>> {
    return db.selectFrom('booking_uploads')
        .select(['id', 'object_key'])
        .where('booking_submission_id', 'is', null)
        .where('purged_at', 'is', null)
        .where('created_date', '<=', cutoffIso)
        .orderBy('created_date')
        .execute()
}

async function countOverdueUploads(nowIso: string): Promise<number> {
    const row = await db.selectFrom('booking_uploads')
        .select(eb => eb.fn.countAll<string>().as('count'))
        .where('purged_at', 'is', null)
        .where('retain_until', 'is not', null)
        .where('retain_until', '<=', nowIso)
        .executeTakeFirstOrThrow()

    return Number(row.count)
}

export async function purgeExpiredBookingUploads(options: {
    write: boolean
    now?: Date
}): Promise<BookingUploadPurgeResult> {
    const now = options.now ?? new Date()
    const nowIso = now.toISOString()
    const expired = await listExpiredUploads(nowIso)
    let purged = 0
    let failed = 0

    if (options.write) {
        for (const upload of expired) {
            try {
                await purgeBookingUpload(upload, nowIso)
                purged += 1
            } catch {
                failed += 1
            }
        }
    }

    const cutoff = new Date(now.getTime() - UNCLAIMED_UPLOAD_MAX_AGE_MS).toISOString()
    const unclaimed = await listUnclaimedUploads(cutoff)
    let unclaimedDeleted = 0

    if (options.write) {
        for (const upload of unclaimed) {
            try {
                await deleteBookingObject(upload.object_key)
                await db.deleteFrom('booking_uploads')
                    .where('id', '=', upload.id)
                    .where('booking_submission_id', 'is', null)
                    .where('purged_at', 'is', null)
                    .execute()
                unclaimedDeleted += 1
            } catch {
                failed += 1
            }
        }
    }

    return {
        scanned: expired.length,
        purged,
        unclaimed: unclaimed.length,
        unclaimedDeleted,
        failed,
        overdue: options.write ? await countOverdueUploads(nowIso) : expired.length
    }
}

async function main(): Promise<void> {
    const write = process.argv.includes('--write')

    initializeLogger()
    await initializeKyselyClient()

    try {
        const result = await purgeExpiredBookingUploads({ write })
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ write, ...result }, null, 2))
        if (!write && (result.scanned > 0 || result.unclaimed > 0)) {
            // eslint-disable-next-line no-console
            console.log('Dry-run only. Re-run with --write to delete objects and mark rows purged.')
        }
        if (result.failed > 0 || (write && result.overdue > 0)) {
            process.exitCode = 1
        }
    } finally {
        await closeDatabase()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        // eslint-disable-next-line no-console
        console.error(`purgeExpiredBookingUploads failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
