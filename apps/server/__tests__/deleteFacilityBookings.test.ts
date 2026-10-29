import { afterAll, describe, expect, it } from 'vitest'
import { db } from '../src/kyselyClient.js'
import type { BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { ErrorCode } from '../src/result.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import * as facilityService from '../src/services/facilityService.js'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }

const day = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
day.setUTCHours(2, 0, 0, 0)
const iso = (minutes: number) => new Date(day.getTime() + minutes * 60 * 1000).toISOString()

async function createBookableFacility(): Promise<string> {
    const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
    expect(created.hasErrors).toBe(false)
    const facilityId = created.data.id

    const settings = await clinicAccessService.updateBookingSettings({
        facilityId,
        allowedDurations: [30],
        formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
    }, admin)
    expect(settings.hasErrors).toBe(false)

    const window = await availabilityService.createClinicAvailabilityWindow(
        { clinicSiteId: facilityId, startsAt: iso(0), endsAt: iso(30) },
        'test|staff',
        admin
    )
    expect(window.hasErrors).toBe(false)

    return facilityId
}

describe('deleteFacility with booking data', () => {
    const facilitiesWithBookings: string[] = []

    afterAll(async () => {
        for (const facilityId of facilitiesWithBookings) {
            await db.deleteFrom('booking_appointments').where('facility_id', '=', facilityId).execute()
            await db.deleteFrom('booking_submissions').where('facility_id', '=', facilityId).execute()
            await db.deleteFrom('clinic_availability_windows').where('facility_id', '=', facilityId).execute()
            await db.deleteFrom('booking_settings').where('facility_id', '=', facilityId).execute()
            await db.deleteFrom('facilities').where('id', '=', facilityId).execute()
        }
    })

    it('deletes a clinic whose only booking data is its settings and open times', async () => {
        const facilityId = await createBookableFacility()

        const deleted = await facilityService.deleteFacility(facilityId, 'test|moderator')

        expect(deleted.hasErrors).toBe(false)
        expect(deleted.data.isSuccessful).toBe(true)
        expect(await db.selectFrom('booking_settings').select('facility_id').where('facility_id', '=', facilityId).execute())
            .toEqual([])
    })

    it('refuses a clinic with bookings, says how many, and keeps everything', async () => {
        const facilityId = await createBookableFacility()
        facilitiesWithBookings.push(facilityId)

        const booked = await bookingService.submitBooking({
            clinicSiteId: facilityId,
            formDefinitionId: DEFAULT_BOOKING_FORM_ID,
            formVersion: 1,
            locale: 'en-US',
            answers: [
                { fieldId: 'email', value: 'patient@example.com' },
                { fieldId: 'phone', value: '090-1234-5678' },
                { fieldId: 'fullName', value: 'Test Patient' },
                { fieldId: 'reason', value: 'Checkup' }
            ],
            startsAt: iso(0),
            durationMinutes: 30,
            confirmedInJapan: true,
            healthDataConsent: true
        })
        expect(booked.hasErrors).toBe(false)

        const refused = await facilityService.deleteFacility(facilityId, 'test|moderator')

        expect(refused.hasErrors).toBe(true)
        expect(refused.data.isSuccessful).toBe(false)
        expect(refused.errors).toEqual([{
            field: 'deleteFacility',
            errorCode: ErrorCode.FACILITY_HAS_BOOKINGS,
            httpStatus: 409,
            count: 1
        }])
        expect(await db.selectFrom('facilities').select('id').where('id', '=', facilityId).executeTakeFirst())
            .toEqual({ id: facilityId })
        expect(await db.selectFrom('booking_settings').select('facility_id').where('facility_id', '=', facilityId).execute())
            .toHaveLength(1)
    })
})
