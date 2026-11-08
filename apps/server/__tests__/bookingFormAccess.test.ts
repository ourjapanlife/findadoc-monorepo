import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { BookingAccess } from '../src/booking/access.js'
import {
    DEFAULT_BOOKING_FORM_ID,
    SHOWCASE_BOOKING_FORM_ID,
    formsTakePayment
} from '../src/booking/formDefinitions.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { db } from '../src/kyselyClient.js'
import { ErrorCode } from '../src/result.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import * as facilityService from '../src/services/facilityService.js'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const ownerOf = (facilityId: string): BookingAccess => ({
    readAll: false,
    writeAll: false,
    manageMembersAll: false,
    memberships: new Map([[facilityId, 'owner']])
})

describe('offering the online consult form', () => {
    let ordinaryId = ''
    let previewId = ''
    let publishedId = ''

    async function createFacility(): Promise<string> {
        const created = await facilityService.createFacility(generateRandomCreateFacilityInput(), 'test|moderator')
        expect(created.hasErrors).toBe(false)
        return created.data.id
    }

    async function addSite(facilityId: string, status: 'preview' | 'published'): Promise<void> {
        await db.insertInto('clinic_sites')
            .values({
                facility_id: facilityId,
                slug: `form-access-${randomUUID()}`,
                status,
                share_image_path: '/clinic-landings/form-access/hero.jpg',
                hero_path: '/clinic-landings/form-access/hero.jpg',
                theme: JSON.stringify({})
            })
            .execute()
    }

    beforeAll(async () => {
        ordinaryId = await createFacility()
        previewId = await createFacility()
        publishedId = await createFacility()
        await addSite(previewId, 'preview')
        await addSite(publishedId, 'published')
    })

    afterAll(async () => {
        const ids = [ordinaryId, previewId, publishedId]
        await db.deleteFrom('booking_settings').where('facility_id', 'in', ids).execute()
        await db.deleteFrom('clinic_sites').where('facility_id', 'in', ids).execute()
        await db.deleteFrom('facilities').where('id', 'in', ids).execute()
    })

    function save(facilityId: string, access: BookingAccess, formDefinitionIds: string[]) {
        return clinicAccessService.updateBookingSettings(
            { facilityId, allowedDurations: [30], formDefinitionIds },
            access
        )
    }

    it('refuses the owner of a clinic with no preview site', async () => {
        for (const facilityId of [ordinaryId, publishedId]) {
            const both = [DEFAULT_BOOKING_FORM_ID, SHOWCASE_BOOKING_FORM_ID]
            const result = await save(facilityId, ownerOf(facilityId), both)
            expect(result.hasErrors).toBe(true)
            expect(result.errors?.[0]).toMatchObject({ field: 'formDefinitionIds', errorCode: ErrorCode.FORBIDDEN })
        }
        const stored = await db.selectFrom('booking_settings')
            .select('facility_id')
            .where('facility_id', 'in', [ordinaryId, publishedId])
            .execute()
        expect(stored).toEqual([])
    })

    it('does not list the form to that owner', async () => {
        const settings = await clinicAccessService.getBookingSettings(ordinaryId, ownerOf(ordinaryId))
        expect(settings?.offerableFormDefinitionIds).toContain(DEFAULT_BOOKING_FORM_ID)
        expect(settings?.offerableFormDefinitionIds).not.toContain(SHOWCASE_BOOKING_FORM_ID)
    })

    it('lets the owner of a preview clinic offer it', async () => {
        const result = await save(previewId, ownerOf(previewId), [SHOWCASE_BOOKING_FORM_ID])
        expect(result.hasErrors).toBe(false)
        expect(result.data.formDefinitionIds).toEqual([SHOWCASE_BOOKING_FORM_ID])
        expect(result.data.offerableFormDefinitionIds).toContain(SHOWCASE_BOOKING_FORM_ID)
    })

    it('lets an admin offer it, and the owner may then keep or remove it', async () => {
        const byAdmin = await save(ordinaryId, admin, [DEFAULT_BOOKING_FORM_ID, SHOWCASE_BOOKING_FORM_ID])
        expect(byAdmin.hasErrors).toBe(false)

        const kept = await save(ordinaryId, ownerOf(ordinaryId), [SHOWCASE_BOOKING_FORM_ID, DEFAULT_BOOKING_FORM_ID])
        expect(kept.hasErrors).toBe(false)

        const removed = await save(ordinaryId, ownerOf(ordinaryId), [DEFAULT_BOOKING_FORM_ID])
        expect(removed.hasErrors).toBe(false)
        expect(removed.data.offerableFormDefinitionIds).not.toContain(SHOWCASE_BOOKING_FORM_ID)

        const both = [DEFAULT_BOOKING_FORM_ID, SHOWCASE_BOOKING_FORM_ID]
        const readded = await save(ordinaryId, ownerOf(ordinaryId), both)
        expect(readded.hasErrors).toBe(true)
    })

    it('tells the dashboard whether the clinic takes payment, so its list opens on the right status', async () => {
        expect(formsTakePayment([SHOWCASE_BOOKING_FORM_ID])).toBe(true)
        expect(formsTakePayment([DEFAULT_BOOKING_FORM_ID])).toBe(false)
        expect((await clinicAccessService.getBookingClinic(previewId, admin))?.takesPayment).toBe(true)
        expect((await clinicAccessService.getBookingClinic(ordinaryId, admin))?.takesPayment).toBe(false)
    })
})
