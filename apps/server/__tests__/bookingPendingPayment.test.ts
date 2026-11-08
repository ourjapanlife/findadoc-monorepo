import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { BookingAppointmentStatus, BookingPaymentMethod } from '@findadoc/graphql'
import { db } from '../src/kyselyClient.js'
import { MEMBERSHIP_ROLE, type BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID, SHOWCASE_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { APPOINTMENT_STATUS, type AppointmentStatus } from '../src/booking/lifecycle.js'
import { newPatientToken } from '../src/booking/links.js'
import * as notifications from '../src/booking/notifications.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { logger } from '../src/logger.js'
import { ErrorCode } from '../src/result.js'
import * as appointmentService from '../src/services/appointmentService.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import * as facilityService from '../src/services/facilityService.js'
import * as staffBookingService from '../src/services/staffBookingService.js'
import { asJsonb } from '../utils/dbUtils.js'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const memberOf = (facilityId: string, role: 'owner' | 'staff'): BookingAccess => ({
    readAll: false,
    writeAll: false,
    manageMembersAll: false,
    memberships: new Map([[facilityId, role]])
})

const day = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
day.setUTCHours(1, 0, 0, 0)
const iso = (minutes: number) => new Date(day.getTime() + minutes * 60 * 1000).toISOString()

describe('pending payment bookings', () => {
    let facilityId = ''
    let otherFacilityId = ''

    beforeAll(async () => {
        for (const assign of [(id: string) => { facilityId = id }, (id: string) => { otherFacilityId = id }]) {
            const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
            expect(created.hasErrors).toBe(false)
            assign(created.data.id)
        }
        const settings = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [30],
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID, SHOWCASE_BOOKING_FORM_ID]
        }, admin)
        expect(settings.hasErrors).toBe(false)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        for (const id of [facilityId, otherFacilityId]) {
            await db.deleteFrom('booking_appointments').where('facility_id', '=', id).execute()
            await db.deleteFrom('booking_submissions').where('facility_id', '=', id).execute()
            await db.deleteFrom('clinic_availability_windows').where('facility_id', '=', id).execute()
            await db.deleteFrom('booking_settings').where('facility_id', '=', id).execute()
            await db.deleteFrom('facilities').where('id', '=', id).execute()
        }
    })

    /** A stored online consult request, as submitBooking would leave it, without the upload round trip. */
    async function storeConsult(
        minutes: number,
        status: AppointmentStatus,
        overrides: Record<string, string> = {},
        target = facilityId
    ): Promise<{ submissionId: string, appointmentId: string }> {
        const answers = {
            email: 'consult@example.com',
            phone: '090-1234-5678',
            fullName: 'Test Patient',
            reason: 'Headache',
            pastIllnesses: 'Asthma',
            addressInJapan: '1-1 Shiba, Minato-ku, Tokyo',
            consultationLanguage: 'ne',
            paymentMethod: 'bankTransfer',
            ...overrides
        }
        const submission = await db.insertInto('booking_submissions')
            .values({
                facility_id: target,
                clinic_site_id: null,
                form_definition_id: SHOWCASE_BOOKING_FORM_ID,
                form_version: 4,
                locale: 'en-US',
                answers: asJsonb(answers),
                status: 'received',
                cancel_token_hash: newPatientToken().hash
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        const appointment = await db.insertInto('booking_appointments')
            .values({
                facility_id: target,
                clinic_site_id: null,
                booking_submission_id: submission.id,
                starts_at: iso(minutes),
                ends_at: iso(minutes + 30),
                duration_minutes: 30,
                status
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        return { submissionId: submission.id, appointmentId: appointment.id }
    }

    it('lets the database store pending_payment and holds its slot', async () => {
        await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(0), endsAt: iso(60) },
            'test|staff',
            admin
        )
        await storeConsult(0, APPOINTMENT_STATUS.PENDING_PAYMENT)

        const starts = await bookingService.getAvailableBookingStarts(facilityId, iso(0), iso(60), 30)
        expect(starts).toEqual([iso(30)])
    })

    it('counts pending payment in the clinic badge', async () => {
        const clinic = await clinicAccessService.getBookingClinic(facilityId, admin)
        expect(clinic?.requestedCount).toBeGreaterThanOrEqual(1)
    })

    it('shows the payment method on the list and the detail, and filters on pending payment', async () => {
        const { submissionId } = await storeConsult(120, APPOINTMENT_STATUS.PENDING_PAYMENT, { paymentMethod: 'payPay' })
        await storeConsult(180, APPOINTMENT_STATUS.CONFIRMED)

        const pending = await staffBookingService.searchBookingSubmissions(
            { facilityId, appointmentStatus: BookingAppointmentStatus.PendingPayment },
            memberOf(facilityId, MEMBERSHIP_ROLE.STAFF)
        )
        expect(pending.length).toBeGreaterThanOrEqual(2)
        expect(pending.every(row => row.appointmentStatus === BookingAppointmentStatus.PendingPayment)).toBe(true)
        expect(pending.find(row => row.id === submissionId)?.paymentMethod).toBe(BookingPaymentMethod.PayPay)

        const detail = await staffBookingService.getBookingSubmissionDetail(submissionId, admin)
        expect(detail?.paymentMethod).toBe(BookingPaymentMethod.PayPay)
    })

    it('moves pending payment to confirmed and back to pending payment', async () => {
        const { appointmentId } = await storeConsult(240, APPOINTMENT_STATUS.PENDING_PAYMENT)
        const staff = memberOf(facilityId, MEMBERSHIP_ROLE.STAFF)

        const confirmed = await appointmentService.updateAppointmentStatus(
            { appointmentId, status: BookingAppointmentStatus.Confirmed },
            staff,
            'test|staff'
        )
        expect(confirmed.data?.status).toBe(BookingAppointmentStatus.Confirmed)

        const unpaid = await appointmentService.updateAppointmentStatus(
            { appointmentId, status: BookingAppointmentStatus.PendingPayment },
            staff,
            'test|staff'
        )
        expect(unpaid.hasErrors).toBe(false)
        expect(unpaid.data.status).toBe(BookingAppointmentStatus.PendingPayment)
    })

    it('sends the patient no email when a confirmed visit is marked unpaid, but does on confirm', async () => {
        const { appointmentId } = await storeConsult(270, APPOINTMENT_STATUS.CONFIRMED)
        const notice = vi.spyOn(notifications, 'sendBookingNotice').mockResolvedValue(true)

        const unpaid = await appointmentService.updateAppointmentStatus(
            { appointmentId, status: BookingAppointmentStatus.PendingPayment },
            admin,
            'test|staff'
        )
        expect(unpaid.hasErrors).toBe(false)
        expect(notice).not.toHaveBeenCalled()

        const confirmed = await appointmentService.updateAppointmentStatus(
            { appointmentId, status: BookingAppointmentStatus.Confirmed },
            admin,
            'test|staff'
        )
        expect(confirmed.hasErrors).toBe(false)
        expect(notice).toHaveBeenCalledTimes(1)
    })

    it('refuses a move to pending payment from a request, and from another clinic', async () => {
        const request = await storeConsult(300, APPOINTMENT_STATUS.REQUESTED)
        const refused = await appointmentService.updateAppointmentStatus(
            { appointmentId: request.appointmentId, status: BookingAppointmentStatus.PendingPayment },
            admin,
            'test|staff'
        )
        expect(refused.hasErrors).toBe(true)

        const confirmed = await storeConsult(330, APPOINTMENT_STATUS.CONFIRMED)
        const outsider = await appointmentService.updateAppointmentStatus(
            { appointmentId: confirmed.appointmentId, status: BookingAppointmentStatus.PendingPayment },
            memberOf(otherFacilityId, MEMBERSHIP_ROLE.OWNER),
            'test|outsider'
        )
        expect(outsider.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_FOUND)
    })

    it('counts pending payment toward the open-request limit for one email', async () => {
        for (const minutes of [360, 390, 420]) {
            await storeConsult(minutes, APPOINTMENT_STATUS.PENDING_PAYMENT, { email: 'limit@example.com' })
        }
        await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(480), endsAt: iso(510) },
            'test|staff',
            admin
        )
        const refused = await bookingService.submitBooking({
            clinicSiteId: facilityId,
            formDefinitionId: DEFAULT_BOOKING_FORM_ID,
            formVersion: 1,
            locale: 'en-US',
            answers: [
                { fieldId: 'email', value: 'Limit@Example.com' },
                { fieldId: 'phone', value: '090-1234-5678' },
                { fieldId: 'fullName', value: 'Test Patient' },
                { fieldId: 'reason', value: 'Checkup' }
            ],
            startsAt: iso(480),
            durationMinutes: 30,
            confirmedInJapan: true,
            healthDataConsent: true
        })
        expect(refused.errors?.[0]?.errorCode).toBe(ErrorCode.OPEN_REQUEST_LIMIT)
    })

    it('starts a request on the standard form as requested', async () => {
        const submitted = await bookingService.submitBooking({
            clinicSiteId: facilityId,
            formDefinitionId: DEFAULT_BOOKING_FORM_ID,
            formVersion: 1,
            locale: 'en-US',
            answers: [
                { fieldId: 'email', value: 'standard@example.com' },
                { fieldId: 'phone', value: '090-1234-5678' },
                { fieldId: 'fullName', value: 'Test Patient' },
                { fieldId: 'reason', value: 'Checkup' }
            ],
            startsAt: iso(480),
            durationMinutes: 30,
            confirmedInJapan: true,
            healthDataConsent: true
        })
        expect(submitted.hasErrors).toBe(false)
        expect(submitted.data.appointmentStatus).toBe(BookingAppointmentStatus.Requested)
    })

    describe('export', () => {
        it('gives the owner contact and scheduling columns only, filtered by status', async () => {
            const { submissionId } = await storeConsult(600, APPOINTMENT_STATUS.PENDING_PAYMENT, { email: 'export@example.com' })

            const result = await staffBookingService.exportBookingSubmissions(
                facilityId,
                BookingAppointmentStatus.PendingPayment,
                memberOf(facilityId, MEMBERSHIP_ROLE.OWNER),
                'test|owner'
            )
            expect(result.hasErrors).toBe(false)
            expect(result.data.truncated).toBe(false)
            expect(result.data.rows.every(row => row.appointmentStatus === BookingAppointmentStatus.PendingPayment))
                .toBe(true)
            const row = result.data.rows.find(item => item.id === submissionId)
            expect(row).toMatchObject({
                email: 'export@example.com',
                phone: '090-1234-5678',
                patientName: 'Test Patient',
                consultationLanguage: 'ne',
                paymentMethod: BookingPaymentMethod.BankTransfer,
                startsAt: iso(600)
            })
            // No medical answer, address, or file is in the export.
            expect(Object.keys(row ?? {}).sort()).toEqual([
                'appointmentStatus', 'consultationLanguage', 'createdDate', 'email', 'endsAt', 'id',
                'patientName', 'paymentMethod', 'phone', 'startsAt'
            ])
        })

        it('logs ids and a count only, never a patient field', async () => {
            await storeConsult(630, APPOINTMENT_STATUS.PENDING_PAYMENT, { email: 'logged@example.com' })
            const info = vi.spyOn(logger, 'info')

            const result = await staffBookingService.exportBookingSubmissions(
                facilityId,
                null,
                memberOf(facilityId, MEMBERSHIP_ROLE.OWNER),
                'test|owner'
            )
            expect(result.hasErrors).toBe(false)
            // winston types info() by its single-object overload; the service calls (message, meta).
            const calls: unknown[][] = info.mock.calls
            const meta = calls.map(args => args[1]).find(item =>
                typeof item === 'object' && item !== null && 'type' in item && item.type === 'bookingExport')
            expect(meta).toBeDefined()
            expect(Object.keys(meta ?? {}).sort()).toEqual([
                'actor', 'appointmentStatus', 'facilityId', 'rowCount', 'truncated', 'type'
            ])
            const logged = JSON.stringify(calls)
            for (const value of ['logged@example.com', 'Test Patient', '090-1234-5678', 'Headache', 'Shiba']) {
                expect(logged).not.toContain(value)
            }
        })

        it('refuses a malformed facility id before it reaches the database', async () => {
            const result = await staffBookingService.exportBookingSubmissions('not-a-uuid', null, admin, 'test|admin')
            expect(result.errors?.[0]?.errorCode).toBe(ErrorCode.INVALID_INPUT)
        })

        it('lets an admin export any clinic', async () => {
            const result = await staffBookingService.exportBookingSubmissions(facilityId, null, admin, 'test|admin')
            expect(result.hasErrors).toBe(false)
            expect(result.data.rows.length).toBeGreaterThan(0)
        })

        it('refuses staff, and the owner of another clinic', async () => {
            const staff = await staffBookingService.exportBookingSubmissions(
                facilityId,
                null,
                memberOf(facilityId, MEMBERSHIP_ROLE.STAFF),
                'test|staff'
            )
            expect(staff.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_FOUND)

            const otherOwner = await staffBookingService.exportBookingSubmissions(
                facilityId,
                null,
                memberOf(otherFacilityId, MEMBERSHIP_ROLE.OWNER),
                'test|outsider'
            )
            expect(otherOwner.errors?.[0]?.errorCode).toBe(ErrorCode.NOT_FOUND)
        })

        it('never returns another clinic\'s rows', async () => {
            const foreign = await storeConsult(660, APPOINTMENT_STATUS.PENDING_PAYMENT, {}, otherFacilityId)
            const result = await staffBookingService.exportBookingSubmissions(facilityId, null, admin, 'test|admin')
            expect(result.data.rows.some(row => row.id === foreign.submissionId)).toBe(false)
        })

        it('stops at 1000 rows and says it was cut short', async () => {
            const values = Array.from({ length: staffBookingService.EXPORT_MAX_ROWS + 1 }, () => ({
                facility_id: otherFacilityId,
                clinic_site_id: null,
                form_definition_id: SHOWCASE_BOOKING_FORM_ID,
                form_version: 4,
                locale: 'en-US',
                answers: asJsonb({ email: 'bulk@example.com' }),
                status: 'received'
            }))
            await db.insertInto('booking_submissions').values(values).execute()

            const result = await staffBookingService.exportBookingSubmissions(otherFacilityId, null, admin, 'test|admin')
            expect(result.data.rows).toHaveLength(staffBookingService.EXPORT_MAX_ROWS)
            expect(result.data.truncated).toBe(true)
        })
    })
})
