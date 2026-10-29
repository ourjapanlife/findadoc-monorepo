import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { purgeExpiredBookingUploads } from '../utils/purgeExpiredBookingUploads.js'

const DAY_MS = 24 * 60 * 60 * 1000

describe('booking upload purge', () => {
    const ids = { expired: randomUUID(), current: randomUUID(), unclaimed: randomUUID() }

    afterAll(async () => {
        await db.deleteFrom('booking_uploads').where('id', 'in', Object.values(ids)).execute()
    })

    async function insertUpload(id: string, values: { retainUntil: Date, createdDate: Date }) {
        await db.insertInto('booking_uploads')
            .values({
                id,
                facility_id: sharedFacilityIds[0]!,
                clinic_site_id: null,
                booking_submission_id: null,
                field_id: 'insuranceCard',
                // No local file: the purge still marks the row.
                object_key: `uploads/booking/test/${id}/card.jpg`,
                content_type: 'image/jpeg',
                file_name: 'card.jpg',
                byte_size: 10,
                sensitivity: 'identity_document',
                retain_until: values.retainUntil.toISOString(),
                purged_at: null,
                created_date: values.createdDate.toISOString()
            })
            .execute()
    }

    it('marks expired uploads purged, deletes stale unclaimed ones, and leaves the rest', async () => {
        const now = new Date()
        // Expired, but created this hour, so it is not also unclaimed.
        await insertUpload(ids.expired, { retainUntil: new Date(now.getTime() - 1000), createdDate: now })
        await insertUpload(ids.current, { retainUntil: new Date(now.getTime() + 30 * DAY_MS), createdDate: now })
        await insertUpload(ids.unclaimed, {
            retainUntil: new Date(now.getTime() + 30 * DAY_MS),
            createdDate: new Date(now.getTime() - 2 * DAY_MS)
        })

        const dryRun = await purgeExpiredBookingUploads({ write: false, now })

        expect(dryRun.purged).toBe(0)
        expect(dryRun.overdue).toBeGreaterThanOrEqual(1)

        const result = await purgeExpiredBookingUploads({ write: true, now })

        expect(result.failed).toBe(0)
        expect(result.overdue).toBe(0)
        expect(result.purged).toBeGreaterThanOrEqual(1)
        expect(result.unclaimedDeleted).toBeGreaterThanOrEqual(1)

        const rows = await db.selectFrom('booking_uploads')
            .select(['id', 'object_key', 'file_name', 'purged_at'])
            .where('id', 'in', Object.values(ids))
            .execute()
        const byId = new Map(rows.map(row => [row.id, row]))

        expect(byId.get(ids.expired)?.object_key).toBe(`purged/${ids.expired}`)
        expect(byId.get(ids.expired)?.file_name).toBe('')
        expect(byId.get(ids.expired)?.purged_at).not.toBeNull()
        expect(byId.get(ids.current)?.purged_at).toBeNull()
        expect(byId.get(ids.current)?.file_name).toBe('card.jpg')
        expect(byId.has(ids.unclaimed)).toBe(false)
    })
})
