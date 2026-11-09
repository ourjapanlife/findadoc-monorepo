import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import * as gqlTypes from '@findadoc/graphql'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { errorLogFields, logger } from '../src/logger.js'
import { purgeExpiredBookingAnswers } from '../src/booking/answerPurge.js'
import type { BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { fakeGooglePlaceId, generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { generateRandomCreateSubmissionInput, generateRandomUpdateSubmissionInput } from '../src/fakeData/fakeSubmissions.js'
import * as facilityService from '../src/services/facilityService.js'
import * as staffBookingService from '../src/services/staffBookingService.js'
import { createSubmission, updateSubmission } from '../src/services/submissionService.js'
import { purgeExpiredSubmissionNotes } from '../src/submissions/notesPurge.js'
import {
    DECIDED_NOTES_RETENTION_DAYS,
    UNDECIDED_NOTES_RETENTION_DAYS,
    submissionRetainUntil
} from '../src/submissions/notesRetention.js'
import { SUBMISSION_STATUS } from '../src/typeDefs/kyselyTypes.js'
import { asJsonb } from '../utils/dbUtils.js'

const DAY_MS = 24 * 60 * 60 * 1000
const QUARTER_HOUR_MS = 15 * 60 * 1000
const TEST_USER = 'submission-retention-test'

// Fake visitor text. The purge must never write it to a log.
const FAKE_NOTE = 'Retention test note: call Testvisitor on 090-0000-0236'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }

function daysFrom(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS)
}

async function storedSubmission(id: string) {
    return db.selectFrom('submissions')
        .select(['notes', 'retain_until', 'status', 'created_date'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

async function latestAuditValues(submissionId: string): Promise<string> {
    const rows = await db.selectFrom('audit_logs')
        .select(['new_value', 'old_value'])
        .where('object_type', '=', gqlTypes.ObjectType.Submission)
        .where('updated_by', '=', TEST_USER)
        .orderBy('updated_date', 'desc')
        .execute()
    return JSON.stringify(rows.filter(row => JSON.stringify(row).includes(submissionId)))
}

describe('submission notes retention (#236)', () => {
    const submissionIds: string[] = []
    const auditIds: string[] = []

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        if (submissionIds.length > 0) {
            await db.deleteFrom('submissions').where('id', 'in', submissionIds).execute()
        }
        await db.deleteFrom('audit_logs').where('updated_by', '=', TEST_USER).execute()
        if (auditIds.length > 0) {
            await db.deleteFrom('audit_logs').where('id', 'in', auditIds).execute()
        }
    })

    /** A pending listing with a note, sent `createdDaysAgo` days before `now`. */
    async function insertListing(now: Date, values: {
        createdDaysAgo: number
        status?: typeof SUBMISSION_STATUS[keyof typeof SUBMISSION_STATUS]
        retainUntil: Date
    }): Promise<string> {
        const created = daysFrom(now, -values.createdDaysAgo).toISOString()
        const row = await db.insertInto('submissions')
            .values({
                status: values.status ?? SUBMISSION_STATUS.PENDING,
                created_date: created,
                updated_date: created,
                hps_id: null,
                facilities_id: null,
                google_maps_url: null,
                healthcare_professional_name: 'Retention Testdoctor',
                spoken_languages: asJsonb<gqlTypes.Locale[]>([]),
                notes: FAKE_NOTE,
                facility_partial: null,
                healthcare_professionals_partial: null,
                firestore_id: null,
                retain_until: values.retainUntil.toISOString()
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        submissionIds.push(row.id)
        return row.id
    }

    it('keeps notes 365 days on an undecided submission and 180 days after a decision', () => {
        const created = '2026-01-01T00:00:00.000Z'
        const decided = new Date('2026-03-01T00:00:00.000Z')

        expect(submissionRetainUntil(SUBMISSION_STATUS.PENDING, created, decided))
            .toBe(daysFrom(new Date(created), UNDECIDED_NOTES_RETENTION_DAYS).toISOString())
        expect(submissionRetainUntil(SUBMISSION_STATUS.UNDER_REVIEW, created, decided))
            .toBe(daysFrom(new Date(created), UNDECIDED_NOTES_RETENTION_DAYS).toISOString())
        expect(submissionRetainUntil(SUBMISSION_STATUS.APPROVED, created, decided))
            .toBe(daysFrom(decided, DECIDED_NOTES_RETENTION_DAYS).toISOString())
        expect(submissionRetainUntil(SUBMISSION_STATUS.REJECTED, created, decided))
            .toBe(daysFrom(decided, DECIDED_NOTES_RETENTION_DAYS).toISOString())
    })

    it('sets the cap on submit, moves it on a decline, puts it back on a reopen, and audits no notes', async () => {
        const input = { ...generateRandomCreateSubmissionInput(), notes: FAKE_NOTE }
        const created = await createSubmission(input, TEST_USER)
        expect(created.hasErrors).toBe(false)
        const id = created.data.id
        submissionIds.push(id)

        const submitted = await storedSubmission(id)
        const cap = daysFrom(new Date(submitted.created_date), UNDECIDED_NOTES_RETENTION_DAYS).getTime()
        expect(new Date(submitted.retain_until ?? 0).getTime()).toBe(cap)

        const beforeDecline = Date.now()
        const declined = await updateSubmission(id, { isRejected: true }, TEST_USER)
        expect(declined.hasErrors).toBe(false)
        const declinedRetain = new Date((await storedSubmission(id)).retain_until ?? 0).getTime()
        expect(declinedRetain).toBeGreaterThanOrEqual(daysFrom(new Date(beforeDecline), DECIDED_NOTES_RETENTION_DAYS)
            .getTime())
        expect(declinedRetain).toBeLessThanOrEqual(daysFrom(new Date(), DECIDED_NOTES_RETENTION_DAYS).getTime())

        const reopened = await updateSubmission(id, { isUnderReview: true }, TEST_USER)
        expect(reopened.hasErrors).toBe(false)
        expect(new Date((await storedSubmission(id)).retain_until ?? 0).getTime()).toBe(cap)

        // An edit that keeps the status leaves the clock alone.
        await updateSubmission(id, { notes: `${FAKE_NOTE} (edited)` }, TEST_USER)
        expect(new Date((await storedSubmission(id)).retain_until ?? 0).getTime()).toBe(cap)

        const audited = await latestAuditValues(id)
        expect(audited).toContain(id)
        expect(audited).not.toContain(FAKE_NOTE)
        expect(audited).not.toContain('"notes"')
    })

    it('clears a listing note past retain_until and keeps a current one', async () => {
        const now = new Date()
        const expired = await insertListing(now, {
            createdDaysAgo: 200,
            status: SUBMISSION_STATUS.REJECTED,
            retainUntil: daysFrom(now, -1)
        })
        const current = await insertListing(now, {
            createdDaysAgo: 200,
            status: SUBMISSION_STATUS.APPROVED,
            retainUntil: daysFrom(now, 1)
        })

        const dryRun = await purgeExpiredSubmissionNotes({ write: false, now })
        expect(dryRun.notesDue).toBeGreaterThanOrEqual(1)
        expect(dryRun.notesCleared).toBe(0)
        expect((await storedSubmission(expired)).notes).toBe(FAKE_NOTE)

        const result = await purgeExpiredSubmissionNotes({ write: true, now })
        expect(result.notesCleared).toBeGreaterThanOrEqual(1)

        const cleared = await storedSubmission(expired)
        expect(cleared.notes).toBeNull()
        expect(cleared.status).toBe(SUBMISSION_STATUS.REJECTED)
        expect((await storedSubmission(current)).notes).toBe(FAKE_NOTE)
    })

    it('clears an undecided submission once it is past the submit-time cap', async () => {
        const now = new Date()
        const createdDaysAgo = UNDECIDED_NOTES_RETENTION_DAYS + 1
        const created = daysFrom(now, -createdDaysAgo).toISOString()
        const undecided = await insertListing(now, {
            createdDaysAgo,
            retainUntil: new Date(submissionRetainUntil(SUBMISSION_STATUS.PENDING, created))
        })

        await purgeExpiredSubmissionNotes({ write: true, now })

        expect((await storedSubmission(undecided)).notes).toBeNull()
    })

    it('removes notes from old submission audit entries and leaves the rest of the entry', async () => {
        const rest = { id: randomUUID(), healthcareProfessionalName: 'Retention Testdoctor' }
        const submissionValue = { ...rest, notes: FAKE_NOTE }
        const facilityValue = { id: randomUUID(), notes: 'A facility field that is not a submission note' }
        const inserted = await db.insertInto('audit_logs')
            .values([
                {
                    action_type: gqlTypes.ActionType.Update,
                    object_type: gqlTypes.ObjectType.Submission,
                    schema_version: gqlTypes.SchemaVersion.V1,
                    old_value: JSON.stringify(submissionValue),
                    new_value: JSON.stringify({ ...submissionValue, isRejected: true }),
                    updated_by: 'submission-retention-backfill'
                },
                {
                    action_type: gqlTypes.ActionType.Update,
                    object_type: gqlTypes.ObjectType.Facility,
                    schema_version: gqlTypes.SchemaVersion.V1,
                    old_value: null,
                    new_value: JSON.stringify(facilityValue),
                    updated_by: 'submission-retention-backfill'
                }
            ])
            .returning('id')
            .execute()
        auditIds.push(...inserted.map(row => row.id))

        const dryRun = await purgeExpiredSubmissionNotes({ write: false })
        expect(dryRun.auditEntriesDue).toBeGreaterThanOrEqual(1)
        expect(dryRun.auditEntriesCleared).toBe(0)

        const result = await purgeExpiredSubmissionNotes({ write: true })
        expect(result.auditEntriesCleared).toBeGreaterThanOrEqual(1)

        const rows = await db.selectFrom('audit_logs')
            .select(['id', 'object_type', 'old_value', 'new_value'])
            .where('id', 'in', auditIds)
            .execute()
        const submissionEntry = rows.find(row => row.object_type === gqlTypes.ObjectType.Submission)
        const facilityEntry = rows.find(row => row.object_type === gqlTypes.ObjectType.Facility)

        expect(submissionEntry?.old_value).toEqual(rest)
        expect(submissionEntry?.new_value).toEqual({ ...rest, isRejected: true })
        expect(facilityEntry?.new_value).toEqual(facilityValue)
        expect((await purgeExpiredSubmissionNotes({ write: false })).auditEntriesDue).toBe(0)
    })

    it('reports counts only and logs no note text', async () => {
        const now = new Date()
        await insertListing(now, { createdDaysAgo: 400, retainUntil: daysFrom(now, -10) })
        const calls: unknown[] = []
        for (const level of ['error', 'warn', 'info', 'debug'] as const) {
            vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => {
                calls.push(args)
                return logger
            }) as typeof logger.info)
        }

        const result = await purgeExpiredSubmissionNotes({ write: true, now })

        expect(Object.values(result).every(value => Number.isInteger(value))).toBe(true)
        expect(JSON.stringify(calls)).not.toContain(FAKE_NOTE)
    })
})

describe('appointment status reason retention (#236)', () => {
    const submissionIds: string[] = []

    afterAll(async () => {
        if (submissionIds.length > 0) {
            await db.deleteFrom('booking_appointments').where('booking_submission_id', 'in', submissionIds).execute()
            await db.deleteFrom('booking_submissions').where('id', 'in', submissionIds).execute()
        }
    })

    /** A cancelled request whose visit is still ahead, cancelled `changedDaysAgo` days before `now`. */
    async function insertCancelled(now: Date, changedDaysAgo: number): Promise<string> {
        const submission = await db.insertInto('booking_submissions')
            .values({
                facility_id: sharedFacilityIds[0]!,
                clinic_site_id: null,
                practitioner_id: null,
                service_key: null,
                form_definition_id: DEFAULT_BOOKING_FORM_ID,
                form_version: 1,
                locale: 'en-US',
                answers: asJsonb({}),
                answers_purged_at: daysFrom(now, -changedDaysAgo).toISOString(),
                status: 'notified',
                notify_email_sent_at: null,
                cancel_token_hash: null,
                health_data_consented_at: daysFrom(now, -changedDaysAgo).toISOString(),
                created_date: daysFrom(now, -changedDaysAgo).toISOString()
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        submissionIds.push(submission.id)

        // A visit far enough ahead that the visit time is not what clears the note.
        const startsAt = new Date(Math.floor(daysFrom(now, 30 + submissionIds.length).getTime() / QUARTER_HOUR_MS)
            * QUARTER_HOUR_MS)
        await db.insertInto('booking_appointments')
            .values({
                facility_id: sharedFacilityIds[0]!,
                clinic_site_id: null,
                booking_submission_id: submission.id,
                practitioner_id: null,
                starts_at: startsAt.toISOString(),
                ends_at: new Date(startsAt.getTime() + 4 * QUARTER_HOUR_MS).toISOString(),
                duration_minutes: 60,
                status: 'cancelled',
                status_changed_at: daysFrom(now, -changedDaysAgo).toISOString(),
                status_changed_by: null,
                cancelled_by: 'patient',
                status_reason: 'Retention test cancel note'
            })
            .execute()
        return submission.id
    }

    it('clears a cancel note 91 days after the cancel, keeps one at 89, and staff see it was removed', async () => {
        const now = new Date()
        const old = await insertCancelled(now, 91)
        const recent = await insertCancelled(now, 89)

        const dryRun = await purgeExpiredBookingAnswers({ write: false, now })
        expect(dryRun.reasonsCleared).toBeGreaterThanOrEqual(1)

        await purgeExpiredBookingAnswers({ write: true, now })

        const cleared = await staffBookingService.getBookingSubmissionDetail(old, admin)
        expect(cleared?.statusReason).toBeNull()
        expect(cleared?.statusReasonPurgedAt).not.toBeNull()
        // Not free text, so it stays.
        expect(cleared?.appointmentStatus).toBe(gqlTypes.BookingAppointmentStatus.Cancelled)
        expect(cleared?.cancelledBy).toBe(gqlTypes.BookingCancelledBy.Patient)

        const kept = await staffBookingService.getBookingSubmissionDetail(recent, admin)
        expect(kept?.statusReason).toBe('Retention test cancel note')
        expect(kept?.statusReasonPurgedAt).toBeNull()
    })
})

describe('approving a submission (#236)', () => {
    const facilityIds: string[] = []
    const professionalIds: string[] = []

    afterAll(async () => {
        if (professionalIds.length > 0) {
            await db.deleteFrom('hps_facilities').where('hps_id', 'in', professionalIds).execute()
            await db.deleteFrom('hps').where('id', 'in', professionalIds).execute()
        }
        for (const id of facilityIds) {
            await facilityService.deleteFacility(id, TEST_USER)
        }
    })

    it('does not copy the submitter note into the public profile of the new doctor', async () => {
        const input = { ...generateRandomCreateSubmissionInput(), notes: FAKE_NOTE }
        const created = await createSubmission(input, TEST_USER)
        expect(created.hasErrors).toBe(false)
        const facility = generateRandomCreateFacilityInput()
        // The moderator fills in the professional, and leaves the public text empty.
        const professionals = generateRandomUpdateSubmissionInput().healthcareProfessionals ?? []
        const saved = await updateSubmission(created.data.id, {
            googleMapsUrl: 'https://example.com/clinic',
            healthcareProfessionals: professionals.map(professional => ({
                ...professional,
                additionalInfoForPatients: null
            })),
            facility: {
                ...facility,
                googlePlaceId: fakeGooglePlaceId(),
                contact: { ...facility.contact, googleMapsUrl: 'https://example.com/clinic' }
            }
        }, TEST_USER)
        expect(saved.hasErrors).toBe(false)

        const approved = await updateSubmission(created.data.id, { isApproved: true }, TEST_USER)
        expect(approved.errors).toBeUndefined()

        const row = await db.selectFrom('submissions')
            .select(['hps_id', 'facilities_id', 'notes', 'retain_until'])
            .where('id', '=', created.data.id)
            .executeTakeFirstOrThrow()
        await db.deleteFrom('submissions').where('id', '=', created.data.id).execute()
        if (row.facilities_id !== null) {
            facilityIds.push(row.facilities_id)
        }
        expect(row.hps_id).not.toBeNull()
        professionalIds.push(row.hps_id ?? '')

        const professional = await db.selectFrom('hps')
            .select('additional_info_for_patients')
            .where('id', '=', row.hps_id ?? '')
            .executeTakeFirstOrThrow()
        expect(professional.additional_info_for_patients ?? '').not.toContain(FAKE_NOTE)
        // The note stays private on the submission until its own clock runs out.
        expect(row.notes).toBe(FAKE_NOTE)
        expect(row.retain_until).not.toBeNull()
    })
})

describe('errorLogFields (#236)', () => {
    it('keeps the error name and code and drops the message', () => {
        const error = Object.assign(new Error(`invalid input syntax for type uuid: "${FAKE_NOTE}"`), { code: '22P02' })

        const fields = errorLogFields(error)

        expect(fields).toEqual({ errorName: 'Error', errorCode: '22P02' })
        expect(JSON.stringify(fields)).not.toContain(FAKE_NOTE)
    })

    it('drops a code that is not a short identifier', () => {
        const error = Object.assign(new Error('x'), { code: FAKE_NOTE })

        expect(errorLogFields(error)).toEqual({ errorName: 'Error' })
        expect(errorLogFields('a thrown string')).toEqual({ errorName: 'unknown' })
    })
})
