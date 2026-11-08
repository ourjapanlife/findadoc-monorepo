import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { BookingAppointmentStatus } from '@findadoc/graphql'
import type { BookingAccess } from '../src/booking/access.js'
import { DEFAULT_BOOKING_FORM_ID } from '../src/booking/formDefinitions.js'
import * as notifications from '../src/booking/notifications.js'
import { clinicNameForLocale } from '../src/booking/target.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { db } from '../src/kyselyClient.js'
import * as appointmentService from '../src/services/appointmentService.js'
import * as availabilityService from '../src/services/availabilityService.js'
import * as bookingService from '../src/services/bookingService.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import * as facilityService from '../src/services/facilityService.js'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const SITE_SLUG = 'clinic-name-test-clinic'
const NAME_EN = 'Name Test Clinic'
const NAME_JA = '名前テストクリニック'

// Whole hours well in the future, so each booking finds an open window.
const day = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)
day.setUTCHours(1, 0, 0, 0)
const iso = (minutes: number) => new Date(day.getTime() + minutes * 60 * 1000).toISOString()

describe('clinicNameForLocale', () => {
    const names = { clinicName: NAME_EN, clinicNameJa: NAME_JA }

    it('gives Japanese readers the Japanese name and everyone else the English one', () => {
        expect(clinicNameForLocale(names, 'ja-JP')).toBe(NAME_JA)
        expect(clinicNameForLocale(names, 'en-US')).toBe(NAME_EN)
        expect(clinicNameForLocale(names, 'zh-CN')).toBe(NAME_EN)
        expect(clinicNameForLocale(names, null)).toBe(NAME_EN)
    })
})

describe('the patient-facing clinic name', () => {
    let facilityId = ''
    let siteId = ''

    async function book(locale: string, startMinutes: number, email: string) {
        const submitted = await bookingService.submitBooking({
            clinicSiteId: facilityId,
            formDefinitionId: DEFAULT_BOOKING_FORM_ID,
            formVersion: 1,
            locale,
            answers: [
                { fieldId: 'email', value: email },
                { fieldId: 'phone', value: '090-1234-5678' },
                { fieldId: 'fullName', value: 'Test Patient' },
                { fieldId: 'reason', value: 'Checkup' }
            ],
            startsAt: iso(startMinutes),
            durationMinutes: 30,
            confirmedInJapan: true,
            healthDataConsent: true
        })
        expect(submitted.hasErrors).toBe(false)
        return submitted.data
    }

    beforeAll(async () => {
        const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
        expect(created.hasErrors).toBe(false)
        facilityId = created.data.id
        const settings = await clinicAccessService.updateBookingSettings({
            facilityId,
            allowedDurations: [30],
            formDefinitionIds: [DEFAULT_BOOKING_FORM_ID]
        }, admin)
        expect(settings.hasErrors).toBe(false)

        const site = await db.insertInto('clinic_sites')
            .values({
                facility_id: facilityId,
                slug: SITE_SLUG,
                status: 'preview',
                share_image_path: '/clinic-landings/name-test/hero.jpg',
                hero_path: '/clinic-landings/name-test/hero.jpg',
                theme: JSON.stringify({ primary: '#177A80' })
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        siteId = site.id
        await db.insertInto('clinic_site_locales')
            .values([
                { clinic_site_id: siteId, locale: 'en-US', name: NAME_EN, description: 'Test', document: '{}' },
                { clinic_site_id: siteId, locale: 'ja-JP', name: NAME_JA, description: 'テスト', document: '{}' }
            ])
            .execute()

        const window = await availabilityService.createClinicAvailabilityWindow(
            { clinicSiteId: facilityId, startsAt: iso(0), endsAt: iso(180) },
            'test|staff',
            admin
        )
        expect(window.hasErrors).toBe(false)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        await db.deleteFrom('booking_appointments').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('booking_submissions').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('clinic_availability_windows').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('clinic_site_locales').where('clinic_site_id', '=', siteId).execute()
        await db.deleteFrom('clinic_sites').where('id', '=', siteId).execute()
        await db.deleteFrom('booking_settings').where('facility_id', '=', facilityId).execute()
        await db.deleteFrom('facilities').where('id', '=', facilityId).execute()
    })

    it('gives the Book page both the English and the Japanese clinic site name', async () => {
        const form = await bookingService.getBookingForm(facilityId)

        expect(form?.clinicName).toBe(NAME_EN)
        expect(form?.clinicNameJa).toBe(NAME_JA)
    })

    it('names the clinic in Japanese in a Japanese patient email and on the manage page', async () => {
        const notice = vi.spyOn(notifications, 'sendBookingNotice').mockResolvedValue(true)
        const booked = await book('ja-JP', 0, 'name-ja@example.com')

        const patientEmail = notice.mock.calls.find(([input]) => input.to === 'name-ja@example.com')?.[0].email
        expect(patientEmail?.subject).toContain(NAME_JA)
        expect(patientEmail?.textBody).toContain(NAME_JA)
        expect(patientEmail?.textBody).not.toContain(NAME_EN)
        // The clinic site brands the email with its name in Japanese.
        expect(patientEmail?.htmlBody).toContain('border-top:4px solid')
        expect(patientEmail?.textBody.startsWith(`${NAME_JA}\n\n`)).toBe(true)

        const token = booked.manageToken
        if (token === null || token === undefined) {
            throw new Error('submit returned no manage token')
        }
        const view = await appointmentService.getPatientBooking(token)
        expect(view?.clinicName).toBe(NAME_EN)
        expect(view?.clinicNameJa).toBe(NAME_JA)

        const appointment = await db.selectFrom('booking_appointments')
            .select('id')
            .where('booking_submission_id', '=', booked.id)
            .executeTakeFirstOrThrow()
        notice.mockClear()
        const confirmed = await appointmentService.updateAppointmentStatus(
            { appointmentId: appointment.id, status: BookingAppointmentStatus.Confirmed },
            admin,
            'test|staff'
        )
        expect(confirmed.hasErrors).toBe(false)
        const statusEmail = notice.mock.calls[0]?.[0].email
        expect(statusEmail?.subject).toContain(NAME_JA)
        expect(statusEmail?.textBody).not.toContain(NAME_EN)
        expect(statusEmail?.htmlBody).toContain('border-top:4px solid')
    })

    it('names the clinic in English in an English patient email', async () => {
        const notice = vi.spyOn(notifications, 'sendBookingNotice').mockResolvedValue(true)
        await book('en-US', 60, 'name-en@example.com')

        const patientEmail = notice.mock.calls.find(([input]) => input.to === 'name-en@example.com')?.[0].email
        expect(patientEmail?.subject).toContain(NAME_EN)
        expect(patientEmail?.textBody).toContain(NAME_EN)
        expect(patientEmail?.textBody).not.toContain(NAME_JA)
    })

    it('falls back to the English name for Japanese readers when the site has no Japanese name', async () => {
        await db.deleteFrom('clinic_site_locales')
            .where('clinic_site_id', '=', siteId)
            .where('locale', '=', 'ja-JP')
            .execute()

        const form = await bookingService.getBookingForm(facilityId)
        expect(form?.clinicNameJa).toBe(NAME_EN)
    })
})
