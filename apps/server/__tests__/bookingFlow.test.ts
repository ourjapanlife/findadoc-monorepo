import { afterAll, describe, expect, it } from 'vitest'
import { BookingAppointmentStatus, ClinicMemberRole } from '@findadoc/graphql'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { MEMBERSHIP_ROLE, type BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { hashPatientToken } from '../src/booking/links.js'
import { ErrorCode } from '../src/result.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as appointmentService from '../src/services/appointmentService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
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

async function submit(facilityId: string, startsAt: string, email = 'patient@example.com') {
    return bookingService.submitBooking({
        clinicSiteId: facilityId,
        formDefinitionId: DEFAULT_BOOKING_FORM_ID,
        formVersion: 1,
        locale: 'en-US',
        answers: answers.map(answer => (answer.fieldId === 'email' ? { ...answer, value: email } : answer)),
        startsAt,
        durationMinutes: 60
    })
}

async function openStarts(facilityId: string) {
    return bookingService.getAvailableBookingStarts(facilityId, iso(-60), iso(180), 60)
}

describe('booking flow', () => {
    const createdSubmissionIds: string[] = []

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
    })

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
        expect(await bookingService.getBookingForm(facilityId)).not.toBeNull()
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

        const submitted = await submit(facilityId, iso(0))
        expect(submitted.hasErrors).toBe(false)
        createdSubmissionIds.push(submitted.data.id)
        expect(await openStarts(facilityId)).toEqual([])

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
})
