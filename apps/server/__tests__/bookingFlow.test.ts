import { afterAll, describe, expect, it } from 'vitest'
import { BookingAppointmentStatus, ClinicMemberRole } from '@findadoc/graphql'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { MEMBERSHIP_ROLE, type BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { hashPatientToken } from '../src/booking/links.js'
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

async function submit(facilityId: string, startsAt: string) {
    return bookingService.submitBooking({
        clinicSiteId: facilityId,
        formDefinitionId: DEFAULT_BOOKING_FORM_ID,
        formVersion: 1,
        locale: 'en-US',
        answers,
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
        await db.deleteFrom('clinic_memberships').where('facility_id', '=', facilityId).execute()
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

        // The email carries the token; the database keeps only its hash. Swap in a known token.
        const token = 'patient-token-for-the-booking-flow-test-0001'
        await db.updateTable('booking_submissions')
            .set({ cancel_token_hash: hashPatientToken(token) })
            .where('id', '=', submitted.data.id)
            .execute()

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
