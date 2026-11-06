import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'kysely'
import type { ContactInput } from '@findadoc/graphql'
import { db } from '../src/kyselyClient.js'
import { asJsonb } from '../utils/dbUtils.js'
import { fakeGooglePlaceId, generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { generateRandomCreateSubmissionInput, generateRandomUpdateSubmissionInput } from '../src/fakeData/fakeSubmissions.js'
import { ErrorCode } from '../src/result.js'
import * as facilityService from '../src/services/facilityService.js'
import * as submissionService from '../src/services/submissionService.js'

const MODERATOR = 'test|moderator'
const NOT_A_MAPS_LINK = 'https://example.com/clinic'
const createdFacilityIds: string[] = []

function addressedFacility(overrides: { googlePlaceId?: string | null } = {}) {
    const input = generateRandomCreateFacilityInput()
    return {
        ...input,
        googlePlaceId: overrides.googlePlaceId === undefined ? input.googlePlaceId : overrides.googlePlaceId,
        contact: { ...input.contact, googleMapsUrl: NOT_A_MAPS_LINK }
    }
}

async function createFacility(googlePlaceId: string | null = fakeGooglePlaceId()): Promise<string> {
    const created = await facilityService.createFacility(addressedFacility({ googlePlaceId }), MODERATOR)
    expect(created.hasErrors).toBe(false)
    createdFacilityIds.push(created.data.id)
    return created.data.id
}

afterAll(async () => {
    for (const id of createdFacilityIds) {
        await facilityService.deleteFacility(id, MODERATOR)
    }
})

describe('facility place id (#228)', () => {
    it('refuses a facility with an address and no place id', async () => {
        const created = await facilityService.createFacility(addressedFacility({ googlePlaceId: null }), MODERATOR)

        expect(created.hasErrors).toBe(true)
        expect(created.errors).toEqual([
            { field: 'googlePlaceId', errorCode: ErrorCode.PLACE_ID_REQUIRED, httpStatus: 400 }
        ])
    })

    it('creates a facility with an address and a place id', async () => {
        const placeId = fakeGooglePlaceId()
        const id = await createFacility(placeId)
        const row = await db.selectFrom('facilities').select('google_place_id').where('id', '=', id).executeTakeFirst()

        expect(row?.google_place_id).toBe(placeId)
    })

    it('creates an online facility with no place id', async () => {
        const created = await facilityService.createFacility({
            ...addressedFacility({ googlePlaceId: null }),
            online: true,
            mapLatitude: null,
            mapLongitude: null
        }, MODERATOR)

        expect(created.hasErrors).toBe(false)
        createdFacilityIds.push(created.data.id)
    })

    it('refuses a place id that is not a Places token', async () => {
        const created = await facilityService.createFacility(
            addressedFacility({ googlePlaceId: 'not a place id"><' }),
            MODERATOR
        )

        expect(created.errors).toContainEqual({ field: 'googlePlaceId', errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 })
    })

    it('refuses an update that clears the place id, and keeps the row as it was', async () => {
        const id = await createFacility()
        const before = await db.selectFrom('facilities').select('google_place_id').where('id', '=', id).executeTakeFirst()

        const updated = await facilityService.updateFacility(id, { googlePlaceId: '' }, MODERATOR)
        const after = await db.selectFrom('facilities').select('google_place_id').where('id', '=', id).executeTakeFirst()

        expect(updated.errors).toEqual([
            { field: 'googlePlaceId', errorCode: ErrorCode.PLACE_ID_REQUIRED, httpStatus: 400 }
        ])
        expect(after?.google_place_id).toBe(before?.google_place_id)
    })

    it('lets a facility drop its place id when it becomes online', async () => {
        const id = await createFacility()
        const updated = await facilityService.updateFacility(id, { online: true }, MODERATOR)

        expect(updated.hasErrors).toBe(false)
    })

    it('is enforced by the database for a row written outside the API', async () => {
        const insert = db.insertInto('facilities').values({
            name_en: 'Example Clinic',
            name_ja: 'エグザンプルクリニック',
            contact: asJsonb<ContactInput>(addressedFacility().contact),
            payment_options: '[]',
            supported_languages: '[]',
            google_place_id: null,
            verification_status: 'UNVERIFIED_LOCATION',
            created_date: new Date().toISOString(),
            updated_date: new Date().toISOString()
        })

        await expect(insert.execute()).rejects.toThrow(/facilities_place_id_required/)
    })

    it('reads the place id from the stored Maps URL forms the migration backfills', async () => {
        const read = async (url: string) => (await sql<{ id: string | null }>`
            select facility_place_id_from_maps_url(${url}) as id
        `.execute(db)).rows[0]?.id ?? null

        expect(await read('https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'))
            .toBe('ChIJN1t_tDeuEmsRUsoyG83frY4')
        expect(await read('https://maps.google.com/?q=place_id:ChIJabcdefgh12')).toBe('ChIJabcdefgh12')
        expect(await read('https://www.google.com/maps/place/X/data=!4m2!3m1!1sChIJabcdefgh12!8m2')).toBe('ChIJabcdefgh12')
        // An ftid pair and a short link need the script, which decodes or opens them.
        expect(await read('https://www.google.com/maps/place/X/data=!4m2!3m1!1s0x60188b:0x1')).toBeNull()
        expect(await read('https://maps.app.goo.gl/3eKxTkC4WJ3Vezob9')).toBeNull()
    })
})

describe('submission approval and the place id (#228)', () => {
    async function submissionWithFacility(googlePlaceId: string | null): Promise<string> {
        const created = await submissionService.createSubmission(
            { ...generateRandomCreateSubmissionInput(), googleMapsUrl: NOT_A_MAPS_LINK },
            MODERATOR
        )
        expect(created.hasErrors).toBe(false)
        const filled = generateRandomUpdateSubmissionInput()
        const saved = await submissionService.updateSubmission(created.data.id, {
            ...filled,
            googleMapsUrl: NOT_A_MAPS_LINK,
            facility: addressedFacility({ googlePlaceId })
        }, MODERATOR)
        expect(saved.hasErrors).toBe(false)
        return created.data.id
    }

    it('refuses to publish a clinic with an address and no place id', async () => {
        const id = await submissionWithFacility(null)
        const approved = await submissionService.updateSubmission(id, { isApproved: true }, MODERATOR)

        expect(approved.errors).toEqual([
            { field: 'googlePlaceId', errorCode: ErrorCode.PLACE_ID_REQUIRED, httpStatus: 400 }
        ])
    })

    it('publishes the clinic with the place id saved on the submission', async () => {
        const placeId = fakeGooglePlaceId()
        const id = await submissionWithFacility(placeId)
        const approved = await submissionService.updateSubmission(id, { isApproved: true }, MODERATOR)

        expect(approved.hasErrors).toBe(false)
        const submission = await db.selectFrom('submissions').select('facilities_id').where('id', '=', id).executeTakeFirst()
        const facilityId = submission?.facilities_id ?? ''
        expect(facilityId).not.toBe('')
        createdFacilityIds.push(facilityId)
        const row = await db.selectFrom('facilities').select('google_place_id').where('id', '=', facilityId).executeTakeFirst()
        expect(row?.google_place_id).toBe(placeId)
    })
})
