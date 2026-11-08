import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import type { BookingAccess } from '../src/booking/access.js'
import { db } from '../src/kyselyClient.js'
import * as appointmentService from '../src/services/appointmentService.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import { sharedFacilityIds } from './testSetup.test.js'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const SITE_SLUG = 'branding-test-clinic'
const THEME = {
    primary: '#177A80',
    displayName: 'Branding Test Clinic',
    wordmark: { ja: 'テストクリニック', en: 'Test Clinic' },
    logoPath: '/clinic-landings/branding-test/logo.svg'
}
const BRANDING = {
    displayName: 'Branding Test Clinic',
    wordmark: { ja: 'テストクリニック', en: 'Test Clinic' },
    logoPath: '/clinic-landings/branding-test/logo.svg',
    primary: '#177A80'
}

// A whole hour well in the future, so the patient view still offers cancel.
const day = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
day.setUTCHours(2, 0, 0, 0)
const iso = (minutes: number) => new Date(day.getTime() + minutes * 60 * 1000).toISOString()

function facilityId(): string {
    const id = sharedFacilityIds[0]
    if (id === undefined) {
        throw new Error('testSetup created no facility')
    }
    return id
}

async function setSiteStatus(status: 'draft' | 'preview'): Promise<void> {
    await db.updateTable('clinic_sites').set({ status }).where('slug', '=', SITE_SLUG).execute()
}

describe('clinic branding (online consult v2 §4)', () => {
    const submissionIds: string[] = []

    beforeAll(async () => {
        const saved = await clinicAccessService.updateBookingSettings({
            facilityId: facilityId(),
            allowedDurations: [60],
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, admin)
        expect(saved.hasErrors).toBe(false)
    })

    afterAll(async () => {
        await db.deleteFrom('booking_appointments').where('facility_id', '=', facilityId()).execute()
        if (submissionIds.length > 0) {
            await db.deleteFrom('booking_submissions').where('id', 'in', submissionIds).execute()
        }
        await db.deleteFrom('clinic_availability_windows').where('facility_id', '=', facilityId()).execute()
        await db.deleteFrom('clinic_sites').where('slug', '=', SITE_SLUG).execute()
        await db.deleteFrom('booking_settings').where('facility_id', '=', facilityId()).execute()
    })

    it('leaves a clinic without a clinic site on the Find a Doc layout', async () => {
        expect((await bookingService.getBookingForm(facilityId()))?.branding).toBeNull()
        expect((await clinicAccessService.getBookingClinic(facilityId(), admin))?.branding).toBeNull()
    })

    it('returns the clinic site theme as branding on the form, the dashboard clinic, and the patient view', async () => {
        await db.insertInto('clinic_sites')
            .values({
                facility_id: facilityId(),
                slug: SITE_SLUG,
                status: 'preview',
                share_image_path: '/clinic-landings/branding-test/hero.jpg',
                hero_path: '/clinic-landings/branding-test/hero.jpg',
                theme: JSON.stringify(THEME)
            })
            .execute()

        expect((await bookingService.getBookingForm(facilityId()))?.branding).toEqual(BRANDING)
        expect((await clinicAccessService.getBookingClinic(facilityId(), admin))?.branding).toEqual(BRANDING)

        const window = await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId(), startsAt: iso(0), endsAt: iso(60) },
            'test|staff',
            admin
        )
        expect(window.hasErrors).toBe(false)
        const submitted = await bookingService.submitBooking({
            clinicSiteId: facilityId(),
            formDefinitionId: DEFAULT_BOOKING_FORM_ID,
            formVersion: 1,
            locale: 'en-US',
            answers: [
                { fieldId: 'email', value: 'branding@example.com' },
                { fieldId: 'phone', value: '090-1234-5678' },
                { fieldId: 'fullName', value: 'Test Patient' },
                { fieldId: 'reason', value: 'Checkup' }
            ],
            startsAt: iso(0),
            durationMinutes: 60,
            confirmedInJapan: true,
            healthDataConsent: true
        })
        expect(submitted.hasErrors).toBe(false)
        submissionIds.push(submitted.data.id)
        const token = submitted.data.manageToken
        if (token === null || token === undefined) {
            throw new Error('submit returned no manage token')
        }
        expect((await appointmentService.getPatientBooking(token))?.branding).toEqual(BRANDING)
    })

    it('drops the branding while the clinic site is a draft', async () => {
        await setSiteStatus('draft')
        expect((await bookingService.getBookingForm(facilityId()))?.branding).toBeNull()
        expect((await clinicAccessService.getBookingClinic(facilityId(), admin))?.branding).toBeNull()
        await setSiteStatus('preview')
    })
})
