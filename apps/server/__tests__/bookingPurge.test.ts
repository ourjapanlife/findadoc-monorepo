import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { logger } from '../src/logger.js'
import { purgeExpiredBookingAnswers } from '../src/booking/answerPurge.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { asJsonb } from '../utils/dbUtils.js'
import { purgeExpiredBookingUploads } from '../utils/purgeExpiredBookingUploads.js'

const DAY_MS = 24 * 60 * 60 * 1000
const QUARTER_HOUR_MS = 15 * 60 * 1000

// Fake answers. The purge must never write one of these to a log.
const FAKE_ANSWERS = {
    fullName: 'Retention Testpatient',
    email: 'retention-test@example.com',
    phone: '090-0000-0212',
    dateOfBirth: '1990-01-02',
    reason: 'Retention test visit reason'
}

describe('booking answer purge (#212)', () => {
    const submissionIds: string[] = []

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        if (submissionIds.length > 0) {
            await db.deleteFrom('booking_appointments').where('booking_submission_id', 'in', submissionIds).execute()
            await db.deleteFrom('booking_submissions').where('id', 'in', submissionIds).execute()
        }
    })

    /** A submission with fake answers, and an hour-long appointment that ended `endedDaysAgo` days before `now`. */
    async function insertBooking(now: Date, values: {
        endedDaysAgo?: number
        status?: string
        createdDaysAgo?: number
        statusReason?: string
    }): Promise<string> {
        const createdDate = new Date(now.getTime() - (values.createdDaysAgo ?? values.endedDaysAgo ?? 0) * DAY_MS)
        const submission = await db.insertInto('booking_submissions')
            .values({
                facility_id: sharedFacilityIds[0]!,
                clinic_site_id: null,
                practitioner_id: null,
                service_key: null,
                form_definition_id: DEFAULT_BOOKING_FORM_ID,
                form_version: 1,
                locale: 'en-US',
                answers: asJsonb(FAKE_ANSWERS),
                status: 'notified',
                notify_email_sent_at: null,
                cancel_token_hash: null,
                health_data_consented_at: createdDate.toISOString(),
                created_date: createdDate.toISOString()
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        submissionIds.push(submission.id)

        if (values.endedDaysAgo !== undefined) {
            // Ends a few minutes before the cutoff line, on the 15-minute grid the table requires.
            const endsAt = new Date(Math.floor((now.getTime() - values.endedDaysAgo * DAY_MS) / QUARTER_HOUR_MS)
                * QUARTER_HOUR_MS)
            await db.insertInto('booking_appointments')
                .values({
                    facility_id: sharedFacilityIds[0]!,
                    clinic_site_id: null,
                    booking_submission_id: submission.id,
                    practitioner_id: null,
                    starts_at: new Date(endsAt.getTime() - 4 * QUARTER_HOUR_MS).toISOString(),
                    ends_at: endsAt.toISOString(),
                    duration_minutes: 60,
                    status: values.status ?? 'completed',
                    status_changed_at: null,
                    status_changed_by: null,
                    cancelled_by: null,
                    status_reason: values.statusReason ?? null
                })
                .execute()
        }
        return submission.id
    }

    async function stored(id: string) {
        return db.selectFrom('booking_submissions as booking')
            .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')
            .select([
                'booking.answers',
                'booking.answers_purged_at',
                'booking.form_definition_id',
                'booking.locale',
                'appointment.status',
                'appointment.starts_at',
                'appointment.status_reason'
            ])
            .where('booking.id', '=', id)
            .executeTakeFirstOrThrow()
    }

    it('erases a completed visit 91 days on and keeps one 89 days on', async () => {
        const now = new Date()
        const old = await insertBooking(now, { endedDaysAgo: 91, statusReason: 'Patient note' })
        const recent = await insertBooking(now, { endedDaysAgo: 89, statusReason: 'Patient note' })

        const dryRun = await purgeExpiredBookingAnswers({ write: false, now })
        expect(dryRun.answersErased).toBe(0)
        expect(dryRun.answersDue).toBeGreaterThanOrEqual(1)
        expect((await stored(old)).answers_purged_at).toBeNull()

        const result = await purgeExpiredBookingAnswers({ write: true, now })
        expect(result.answersErased).toBeGreaterThanOrEqual(1)
        expect(result.answersOverdue).toBe(0)

        const erased = await stored(old)
        expect(erased.answers).toEqual({})
        expect(erased.answers_purged_at).not.toBeNull()
        expect(erased.status_reason).toBeNull()
        // What stays for disputes and counts.
        expect(erased.form_definition_id).toBe(DEFAULT_BOOKING_FORM_ID)
        expect(erased.locale).toBe('en-US')
        expect(erased.status).toBe('completed')
        expect(erased.starts_at).not.toBeNull()

        const kept = await stored(recent)
        expect(kept.answers).toEqual(FAKE_ANSWERS)
        expect(kept.answers_purged_at).toBeNull()
        expect(kept.status_reason).toBe('Patient note')
    })

    it('erases a visit nobody marked completed once it is past the period', async () => {
        const now = new Date()
        const confirmed = await insertBooking(now, { endedDaysAgo: 91, status: 'confirmed' })

        await purgeExpiredBookingAnswers({ write: true, now })

        expect((await stored(confirmed)).answers).toEqual({})
    })

    it('counts a request with no appointment from when it was sent', async () => {
        const now = new Date()
        const old = await insertBooking(now, { createdDaysAgo: 91 })
        const recent = await insertBooking(now, { createdDaysAgo: 89 })

        await purgeExpiredBookingAnswers({ write: true, now })

        expect((await stored(old)).answers).toEqual({})
        expect((await stored(recent)).answers).toEqual(FAKE_ANSWERS)
    })

    it('erases a cancelled or declined request that still holds answers, whatever its date', async () => {
        const now = new Date()
        // Visits in the future that were closed before answers were erased on close.
        const cancelled = await insertBooking(now, { endedDaysAgo: -10, status: 'cancelled', createdDaysAgo: 1 })
        const declined = await insertBooking(now, { endedDaysAgo: -11, status: 'declined', createdDaysAgo: 1 })

        await purgeExpiredBookingAnswers({ write: true, now })

        expect((await stored(cancelled)).answers).toEqual({})
        expect((await stored(declined)).answers).toEqual({})
    })

    it('reports counts only and logs no answer value', async () => {
        const now = new Date()
        await insertBooking(now, { endedDaysAgo: 120 })
        const calls: unknown[] = []
        for (const level of ['error', 'warn', 'info', 'debug'] as const) {
            vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => {
                calls.push(args)
                return logger
            }) as typeof logger.info)
        }

        const result = await purgeExpiredBookingAnswers({ write: true, now })

        expect(Object.values(result).every(value => Number.isInteger(value))).toBe(true)
        const logged = JSON.stringify(calls)
        for (const value of Object.values(FAKE_ANSWERS)) {
            expect(logged).not.toContain(value)
        }
    })
})

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
