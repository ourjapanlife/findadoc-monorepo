import { afterAll, describe, expect, it } from 'vitest'
import {
    BookingAppointmentStatus,
    BookingFieldSensitivity,
    BookingFormFieldType,
    ClinicMemberRole,
    Locale
} from '@findadoc/graphql'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { MEMBERSHIP_ROLE, type BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { hashPatientToken } from '../src/booking/links.js'
import { ErrorCode } from '../src/result.js'
import { asJsonb } from '../utils/dbUtils.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as appointmentService from '../src/services/appointmentService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import * as clinicFormService from '../src/services/clinicFormService.js'
import * as staffBookingService from '../src/services/staffBookingService.js'

const moderator: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const outsider: BookingAccess = {
    readAll: false,
    writeAll: false,
    manageMembersAll: false,
    memberships: new Map([['00000000-0000-4000-8000-000000000000', MEMBERSHIP_ROLE.OWNER]])
}

// A whole hour on a day well in the future, so the patient may still cancel.
const day = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
day.setUTCHours(1, 0, 0, 0)
const iso = (minutes: number) => new Date(day.getTime() + minutes * 60 * 1000).toISOString()

const answers = [
    { fieldId: 'email', value: 'patient@example.com' },
    { fieldId: 'phone', value: '090-1234-5678' },
    { fieldId: 'fullName', value: 'Test Patient' },
    { fieldId: 'reason', value: 'Checkup' }
]

async function submit(
    facilityId: string,
    startsAt: string,
    email = 'patient@example.com',
    choice: {
        practitionerId?: string
        spokenLanguages?: Locale[]
        confirmedInJapan?: boolean
        healthDataConsent?: boolean
    } = {}
) {
    return bookingService.submitBooking({
        clinicSiteId: facilityId,
        formDefinitionId: DEFAULT_BOOKING_FORM_ID,
        formVersion: 1,
        locale: 'en-US',
        answers: answers.map(answer => (answer.fieldId === 'email' ? { ...answer, value: email } : answer)),
        startsAt,
        durationMinutes: 60,
        confirmedInJapan: true,
        healthDataConsent: true,
        ...choice
    })
}

async function openStarts(facilityId: string) {
    return bookingService.getAvailableBookingStarts(facilityId, iso(-60), iso(180), 60)
}

describe('booking flow', () => {
    const createdSubmissionIds: string[] = []
    const createdPractitionerIds: string[] = []

    afterAll(async () => {
        const facilityId = sharedFacilityIds[0]!
        await db.deleteFrom('booking_appointments').where('facility_id', '=', facilityId).execute()
        if (createdSubmissionIds.length > 0) {
            await db.deleteFrom('booking_submissions').where('id', 'in', createdSubmissionIds).execute()
        }
        await db.deleteFrom('clinic_availability_windows').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('clinic_weekly_hours').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('clinic_availability_closures').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('clinic_memberships').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('booking_settings').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('booking_form_definitions').where('facility_id', '=', facilityId).execute()
        if (createdPractitionerIds.length > 0) {
            await db.deleteFrom('hps_facilities').where('hps_id', 'in', createdPractitionerIds).execute()
            await db.deleteFrom('hps').where('id', 'in', createdPractitionerIds).execute()
        }
    })

    async function addDoctor(facilityId: string, lastName: string, spokenLanguages: Locale[]): Promise<string> {
        const now = new Date().toISOString()
        const row = await db.insertInto('hps')
            .values({
                names: asJsonb([{ firstName: 'Test', lastName, locale: Locale.EnUs }]),
                degrees: asJsonb([]),
                primary_license: null,
                additional_credentials: asJsonb([]),
                license_review: null,
                license_recommendation: null,
                specialties: asJsonb([]),
                spoken_languages: asJsonb(spokenLanguages),
                accepted_insurance: asJsonb([]),
                additional_info_for_patients: null,
                email: null,
                created_date: now,
                updated_date: now
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        await db.insertInto('hps_facilities').values({ hps_id: row.id, facilities_id: facilityId }).execute()
        createdPractitionerIds.push(row.id)
        return row.id
    }

    it('does not book a facility until its booking settings are saved', async () => {
        const facilityId = sharedFacilityIds[0]!
        await db.deleteFrom('booking_settings').where('facility_id', '=', facilityId).execute()

        expect(await bookingService.getBookingForm(facilityId)).toBeNull()
        expect((await submit(facilityId, iso(0))).hasErrors).toBe(true)

        const saved = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [15, 30, 45, 60],
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, moderator)
        expect(saved.hasErrors).toBe(false)
        expect(saved.data.defaultDuration).toBe(30)
        expect(await bookingService.getBookingForm(facilityId)).not.toBeNull()
    })

    it('saves a default visit length the clinic offers and rejects one it does not', async () => {
        const facilityId = sharedFacilityIds[0]!
        const saved = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [15, 30, 45, 60],
            defaultDuration: 45,
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, moderator)
        expect(saved.hasErrors).toBe(false)
        expect(saved.data.defaultDuration).toBe(45)
        expect((await bookingService.getBookingForm(facilityId))?.defaultDuration).toBe(45)

        const rejected = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [15, 30],
            defaultDuration: 45,
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, moderator)
        expect(rejected.hasErrors).toBe(true)
    })

    it('holds a requested slot, confirms it, and frees it when the patient cancels', async () => {
        const facilityId = sharedFacilityIds[0]!

        // Two painted 30-minute blocks still hold one 60-minute visit.
        for (const [start, end] of [[0, 30], [30, 60]] as const) {
            const window = await availabilityService.createClinicAvailabilityWindow(
                { clinicSiteId: facilityId, startsAt: iso(start), endsAt: iso(end) },
                'test|staff',
                moderator
            )
            expect(window.hasErrors).toBe(false)
        }
        expect(await openStarts(facilityId)).toEqual([iso(0)])

        // Both Book page boxes are required, and a refused request holds nothing.
        const notInJapan = await submit(facilityId, iso(0), undefined, { confirmedInJapan: false })
        expect(notInJapan.errors?.[0]?.field).toBe('confirmedInJapan')
        const noConsent = await submit(facilityId, iso(0), undefined, { healthDataConsent: false })
        expect(noConsent.errors?.[0]?.field).toBe('healthDataConsent')
        expect(await openStarts(facilityId)).toEqual([iso(0)])

        const before = Date.now()
        const submitted = await submit(facilityId, iso(0))
        expect(submitted.hasErrors).toBe(false)
        createdSubmissionIds.push(submitted.data.id)
        expect(await openStarts(facilityId)).toEqual([])

        const consent = await db.selectFrom('booking_submissions')
            .select('health_data_consented_at')
            .where('id', '=', submitted.data.id)
            .executeTakeFirstOrThrow()
        expect(new Date(consent.health_data_consented_at!).getTime()).toBeGreaterThanOrEqual(before - 1000)

        // A second patient cannot take the held slot.
        expect((await submit(facilityId, iso(0))).hasErrors).toBe(true)

        const listed = await staffBookingService.searchBookingSubmissions({ facilityId }, moderator)
        const row = listed.find(item => item.id === submitted.data.id)
        expect(row?.appointmentStatus).toBe(BookingAppointmentStatus.Requested)
        expect(row?.patientName).toBe('Test Patient')

        const confirmed = await appointmentService.updateAppointmentStatus(
            { appointmentId: submitted.data.appointmentId!, status: BookingAppointmentStatus.Confirmed },
            moderator,
            'test|staff'
        )
        expect(confirmed.data.status).toBe(BookingAppointmentStatus.Confirmed)

        // Confirming twice is a stale transition.
        const again = await appointmentService.updateAppointmentStatus(
            { appointmentId: submitted.data.appointmentId!, status: BookingAppointmentStatus.Confirmed },
            moderator,
            'test|staff'
        )
        expect(again.hasErrors).toBe(true)

        // The submitter gets the token once; the database keeps only its hash.
        const token = submitted.data.manageToken!
        const stored = await db.selectFrom('booking_submissions')
            .select('cancel_token_hash')
            .where('id', '=', submitted.data.id)
            .executeTakeFirstOrThrow()
        expect(stored.cancel_token_hash).toBe(hashPatientToken(token))

        const view = await appointmentService.getPatientBooking(token)
        expect(view?.canCancel).toBe(true)
        expect(view?.status).toBe(BookingAppointmentStatus.Confirmed)
        expect(await appointmentService.getPatientBooking('not-the-right-token-but-long-enough-000000')).toBeNull()

        const cancelled = await appointmentService.cancelBookingByToken({ token, reason: 'Feeling better' })
        expect(cancelled.data.status).toBe(BookingAppointmentStatus.Cancelled)
        expect(cancelled.data.canCancel).toBe(false)
        expect(await openStarts(facilityId)).toEqual([iso(0)])

        const detail = await staffBookingService.getBookingSubmissionDetail(submitted.data.id, moderator)
        expect(detail?.statusReason).toBe('Feeling better')
    })

    it('hides one clinic\'s bookings and calendar from another clinic\'s members', async () => {
        const facilityId = sharedFacilityIds[0]!
        const id = createdSubmissionIds[0]!

        expect(await staffBookingService.getBookingSubmissionDetail(id, outsider)).toBeNull()
        expect(await staffBookingService.searchBookingSubmissions({ facilityId }, outsider)).toEqual([])
        expect(await staffBookingService.searchBookingSubmissions({}, outsider)).toEqual([])
        expect(await staffBookingService.countBookingSubmissions({}, outsider)).toBe(0)
        expect(await availabilityService.listClinicAvailabilityWindows(facilityId, iso(-60), iso(180), outsider))
            .toEqual([])
        expect(await appointmentService.listClinicAppointments(facilityId, iso(-60), iso(180), outsider)).toEqual([])

        const created = await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(120), endsAt: iso(150) },
            'test|outsider',
            outsider
        )
        expect(created.hasErrors).toBe(true)
    })

    it('caps the open requests one email holds at one clinic', async () => {
        const facilityId = sharedFacilityIds[0]!
        const window = await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(240), endsAt: iso(540) },
            'test|staff',
            moderator
        )
        expect(window.hasErrors).toBe(false)

        const held: string[] = []
        for (const [start, email] of [[240, 'flood@example.com'], [300, 'Flood@Example.com'], [360, 'FLOOD@example.com']] as const) {
            const submitted = await submit(facilityId, iso(start), email)
            expect(submitted.hasErrors).toBe(false)
            createdSubmissionIds.push(submitted.data.id)
            held.push(submitted.data.appointmentId!)
        }

        const refused = await submit(facilityId, iso(420), 'flood@example.com')
        expect(refused.errors?.[0]?.errorCode).toBe(ErrorCode.OPEN_REQUEST_LIMIT)
        // Another sender can still book the free time.
        const other = await submit(facilityId, iso(420), 'someone-else@example.com')
        expect(other.hasErrors).toBe(false)
        createdSubmissionIds.push(other.data.id)

        // An answered request no longer counts.
        const declined = await appointmentService.updateAppointmentStatus(
            { appointmentId: held[0]!, status: BookingAppointmentStatus.Declined },
            moderator,
            'test|staff'
        )
        expect(declined.hasErrors).toBe(false)
        const afterDecline = await submit(facilityId, iso(480), 'flood@example.com')
        expect(afterDecline.hasErrors).toBe(false)
        createdSubmissionIds.push(afterDecline.data.id)
    })

    it('opens weekly hours without painting, and a closure takes them away', async () => {
        const facilityId = sharedFacilityIds[0]!
        // The next day, 10:00-11:00 JST: nothing painted there.
        const next = (minutes: number) => iso(24 * 60 + minutes)
        const nextStarts = () => bookingService.getAvailableBookingStarts(facilityId, next(-60), next(120), 60)
        const jstWeekday = new Date(new Date(next(0)).getTime() + 9 * 60 * 60 * 1000).getUTCDay() || 7

        expect(await nextStarts()).toEqual([])
        const hours = await availabilityService.setClinicWeeklyHours({
            facilityId,
            hours: [
                { weekday: jstWeekday, startMinute: 600, endMinute: 630 },
                { weekday: jstWeekday, startMinute: 630, endMinute: 660 }
            ]
        }, 'test|staff', moderator)
        // Touching blocks are stored as one.
        expect(hours.data.map(block => [block.startMinute, block.endMinute])).toEqual([[600, 660]])
        expect(await nextStarts()).toEqual([next(0)])

        expect((await availabilityService.setClinicWeeklyHours({
            facilityId,
            hours: [{ weekday: jstWeekday, startMinute: 605, endMinute: 660 }]
        }, 'test|outsider', moderator)).hasErrors).toBe(true)
        expect((await availabilityService.setClinicWeeklyHours({ facilityId, hours: [] }, 'test|outsider', outsider))
            .hasErrors).toBe(true)

        const closure = await availabilityService.createClinicAvailabilityClosure(
            { clinicId: facilityId, startsAt: next(30), endsAt: next(60), reason: 'Staff training' },
            'test|staff',
            moderator
        )
        expect(closure.hasErrors).toBe(false)
        expect(await nextStarts()).toEqual([])
        expect(await availabilityService.listClinicAvailabilityClosures(facilityId, next(-60), next(120), outsider))
            .toEqual([])

        const reopened = await availabilityService.deleteClinicAvailabilityClosure(closure.data.id, moderator)
        expect(reopened.data.isSuccessful).toBe(true)
        expect(await nextStarts()).toEqual([next(0)])

        await availabilityService.setClinicWeeklyHours({ facilityId, hours: [] }, 'test|staff', moderator)
    })

    it('purges the patient\'s files when the clinic declines the visit', async () => {
        const facilityId = sharedFacilityIds[0]!
        const at = (minutes: number) => iso(3 * 24 * 60 + minutes)
        const window = await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: at(0), endsAt: at(60) },
            'test|staff',
            moderator
        )
        expect(window.hasErrors).toBe(false)
        const submitted = await submit(facilityId, at(0), 'files@example.com')
        expect(submitted.hasErrors).toBe(false)
        createdSubmissionIds.push(submitted.data.id)

        const upload = await db.insertInto('booking_uploads')
            .values({
                facility_id: facilityId,
                clinic_site_id: null,
                booking_submission_id: submitted.data.id,
                field_id: 'insuranceDocument',
                object_key: `uploads/booking/${facilityId}/test-purge/card.jpg`,
                content_type: 'image/jpeg',
                file_name: 'Patient insurance card.jpg',
                byte_size: 10,
                sensitivity: 'identity_document',
                retain_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                purged_at: null
            })
            .returning('id')
            .executeTakeFirstOrThrow()

        const declined = await appointmentService.updateAppointmentStatus(
            { appointmentId: submitted.data.appointmentId!, status: BookingAppointmentStatus.Declined },
            moderator,
            'test|staff'
        )
        expect(declined.hasErrors).toBe(false)

        const row = await db.selectFrom('booking_uploads')
            .select(['purged_at', 'object_key', 'file_name'])
            .where('id', '=', upload.id)
            .executeTakeFirstOrThrow()
        expect(row.purged_at).not.toBeNull()
        expect(row.object_key).toBe(`purged/${upload.id}`)
        expect(row.file_name).toBe('')
        expect((await staffBookingService.createStaffBookingDownloadUrl(upload.id, 'http://127.0.0.1:4000', moderator))
            .hasErrors).toBe(true)
        await db.deleteFrom('booking_uploads').where('id', '=', upload.id).execute()
    })

    it('books two doctors at the same time, and picks one who speaks the language', async () => {
        const facilityId = sharedFacilityIds[0]!
        // Two days on, 10:00-11:00 JST: no clinic hours there.
        const later = (minutes: number) => iso(2 * 24 * 60 + minutes)
        const jstWeekday = new Date(new Date(later(0)).getTime() + 9 * 60 * 60 * 1000).getUTCDay() || 7
        const english = await addDoctor(facilityId, 'English', [Locale.EnUs])
        const japanese = await addDoctor(facilityId, 'Japanese', [Locale.JaJp])
        for (const practitionerId of [english, japanese]) {
            const hours = await availabilityService.setClinicWeeklyHours({
                facilityId,
                practitionerId,
                hours: [{ weekday: jstWeekday, startMinute: 600, endMinute: 660 }]
            }, 'test|staff', moderator)
            expect(hours.data[0]?.practitionerId).toBe(practitionerId)
        }

        const form = await bookingService.getBookingForm(facilityId)
        expect(form?.practitioners.filter(doctor => doctor.hasOwnSchedule).map(doctor => doctor.id).sort())
            .toEqual([english, japanese].sort())
        expect(form?.languages).toEqual(expect.arrayContaining([Locale.EnUs, Locale.JaJp]))

        const starts = (practitionerId?: string, spokenLanguages?: Locale[]) =>
            bookingService.getAvailableBookingStarts(
                facilityId, later(-60), later(120), 60, practitionerId, spokenLanguages
            )
        expect(await starts()).toEqual([later(0)])
        expect(await starts(english)).toEqual([later(0)])
        expect(await starts(undefined, [Locale.EnUs])).toEqual([later(0)])

        // The English speaker takes the first English request.
        const first = await submit(facilityId, later(0), 'first@example.com', { spokenLanguages: [Locale.EnUs] })
        expect(first.hasErrors).toBe(false)
        createdSubmissionIds.push(first.data.id)
        const firstDetail = await staffBookingService.getBookingSubmissionDetail(first.data.id, moderator)
        expect(firstDetail?.practitionerId).toBe(english)
        expect(firstDetail?.practitionerNames[0]?.lastName).toBe('English')
        expect(firstDetail?.spokenLanguages).toEqual([Locale.EnUs])

        // That doctor is now busy; the other doctor's 10:00 is still open.
        expect(await starts(english)).toEqual([])
        expect(await starts(undefined, [Locale.EnUs])).toEqual([])
        expect(await starts(japanese)).toEqual([later(0)])

        const second = await submit(facilityId, later(0), 'second@example.com')
        expect(second.hasErrors).toBe(false)
        createdSubmissionIds.push(second.data.id)
        const appointments = await appointmentService.listClinicAppointments(
            facilityId, later(-60), later(120), moderator
        )
        expect(appointments.map(appointment => appointment.practitionerId).sort()).toEqual([english, japanese].sort())

        expect((await submit(facilityId, later(0), 'third@example.com')).hasErrors).toBe(true)
        expect((await submit(facilityId, later(0), 'fourth@example.com', {
            practitionerId: '00000000-0000-4000-8000-000000000000'
        })).errors?.[0]?.field).toBe('practitionerId')

        // A clinic-wide closure closes every doctor.
        await appointmentService.updateAppointmentStatus(
            { appointmentId: second.data.appointmentId!, status: BookingAppointmentStatus.Cancelled },
            moderator,
            'test|staff'
        )
        expect(await starts(japanese)).toEqual([later(0)])
        const closure = await availabilityService.createClinicAvailabilityClosure(
            { clinicId: facilityId, startsAt: later(0), endsAt: later(60) },
            'test|staff',
            moderator
        )
        expect(await starts(japanese)).toEqual([])
        await availabilityService.deleteClinicAvailabilityClosure(closure.data.id, moderator)
    })

    it('lets an owner invite staff but not another owner', async () => {
        const facilityId = sharedFacilityIds[0]!
        const owner: BookingAccess = {
            readAll: false,
            writeAll: false,
            manageMembersAll: false,
            memberships: new Map([[facilityId, MEMBERSHIP_ROLE.OWNER]])
        }

        const staff = await clinicAccessService.inviteClinicMember(
            { facilityId, email: 'Staff@Example.com', role: ClinicMemberRole.Staff },
            owner,
            'test|owner'
        )
        expect(staff.data.email).toBe('staff@example.com')
        expect(staff.data.claimed).toBe(false)

        const promoted = await clinicAccessService.inviteClinicMember(
            { facilityId, email: 'other@example.com', role: ClinicMemberRole.Owner },
            owner,
            'test|owner'
        )
        expect(promoted.hasErrors).toBe(true)

        const members = await clinicAccessService.listClinicMembers(facilityId, owner)
        expect(members.map(member => member.email)).toEqual(['staff@example.com'])
        expect(await clinicAccessService.listClinicMembers(facilityId, outsider)).toEqual([])
    })

    it('books with a form the clinic wrote, and an edit keeps earlier answers readable', async () => {
        const facilityId = sharedFacilityIds[0]!
        const owner: BookingAccess = {
            readAll: false,
            writeAll: false,
            manageMembersAll: false,
            memberships: new Map([[facilityId, MEMBERSHIP_ROLE.OWNER]])
        }
        const english = (text: string) => [{ locale: 'en-US', text }]
        const questions = [
            {
                id: 'allergies',
                stepKey: 'visit',
                type: BookingFormFieldType.Textarea,
                required: true,
                sensitivity: BookingFieldSensitivity.Medical,
                labels: [{ locale: 'en-US', text: 'Allergies' }, { locale: 'ja-JP', text: 'アレルギー' }]
            },
            {
                id: 'referral',
                stepKey: 'visit',
                type: BookingFormFieldType.Select,
                required: false,
                labels: english('How did you hear about us?'),
                options: [
                    { value: 'friend', labels: english('A friend') },
                    { value: 'web', labels: english('The web') }
                ]
            },
            {
                id: 'letter',
                stepKey: 'documents',
                type: BookingFormFieldType.File,
                required: false,
                labels: english('Referral letter')
            }
        ]

        expect((await clinicFormService.saveClinicBookingForm(
            { facilityId, name: 'New patient', fields: questions },
            outsider
        )).hasErrors).toBe(true)

        const created = await clinicFormService.saveClinicBookingForm(
            { facilityId, name: 'New patient', fields: questions },
            owner,
            'test|owner'
        )
        expect(created.hasErrors).toBe(false)
        const formId = created.data.id
        expect(formId.startsWith('clinic-')).toBe(true)
        expect(created.data.version).toBe(1)
        // A file question keeps identity-document retention unless the clinic picks another.
        expect(created.data.fields.find(field => field.id === 'letter')?.sensitivity)
            .toBe(BookingFieldSensitivity.IdentityDocument)
        expect(await clinicFormService.listClinicBookingForms(facilityId, outsider)).toEqual([])

        // A form id the clinic did not write is refused.
        expect((await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [60],
            formDefinitionIds: ['clinic-00000000-0000-4000-8000-000000000000']
        }, owner)).hasErrors).toBe(true)
        const offered = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [60],
            formDefinitionIds: [formId, DEFAULT_BOOKING_FORM_ID]
        }, owner)
        expect(offered.data.formDefinitionIds).toEqual([formId, DEFAULT_BOOKING_FORM_ID])

        const form = await bookingService.getBookingForm(facilityId)
        expect(form?.id).toBe(formId)
        expect(form?.fields.map(field => field.id)).toEqual(['email', 'phone', 'fullName', 'allergies', 'referral', 'letter'])
        expect(form?.fields.find(field => field.id === 'allergies')?.labels)
            .toEqual([{ locale: 'en-US', text: 'Allergies' }, { locale: 'ja-JP', text: 'アレルギー' }])

        await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(720), endsAt: iso(840) },
            'test|staff',
            moderator
        )
        const clinicAnswers = [
            ...answers.filter(answer => answer.fieldId !== 'reason'),
            { fieldId: 'allergies', value: 'Penicillin' },
            { fieldId: 'referral', value: 'friend' }
        ]
        const submitClinicForm = (formVersion: number, startsAt: string, formAnswers = clinicAnswers) =>
            bookingService.submitBooking({
                clinicSiteId: facilityId,
                formDefinitionId: formId,
                formVersion,
                locale: 'en-US',
                answers: formAnswers,
                startsAt,
                durationMinutes: 60,
                confirmedInJapan: true,
                healthDataConsent: true
            })

        const badChoice = await submitClinicForm(1, iso(720), clinicAnswers.map(answer =>
            (answer.fieldId === 'referral' ? { ...answer, value: 'radio' } : answer)))
        expect(badChoice.errors?.[0]?.field).toBe('referral')

        const submitted = await submitClinicForm(1, iso(720))
        expect(submitted.hasErrors).toBe(false)
        createdSubmissionIds.push(submitted.data.id)

        // A new name alone keeps the version.
        const renamed = await clinicFormService.saveClinicBookingForm(
            { facilityId, id: formId, name: 'First visit', fields: questions },
            owner
        )
        expect(renamed.data.version).toBe(1)
        expect(renamed.data.name).toBe('First visit')

        const edited = await clinicFormService.saveClinicBookingForm(
            { facilityId, id: formId, name: 'First visit', fields: [{ ...questions[0]!, labels: english('Known allergies') }] },
            owner
        )
        expect(edited.data.version).toBe(2)
        expect((await bookingService.getBookingForm(facilityId))?.version).toBe(2)
        // A patient still on the first version is asked to reload.
        expect((await submitClinicForm(1, iso(780))).errors?.[0]?.field).toBe('formVersion')

        const detail = await staffBookingService.getBookingSubmissionDetail(submitted.data.id, owner)
        expect(detail?.formVersion).toBe(1)
        expect(detail?.fields.find(field => field.id === 'allergies')?.label).toBe('Allergies')
        expect(detail?.fields.some(field => field.id === 'referral')).toBe(true)
        expect(detail?.answers.find(answer => answer.fieldId === 'allergies')?.value).toBe('Penicillin')
    })
})
