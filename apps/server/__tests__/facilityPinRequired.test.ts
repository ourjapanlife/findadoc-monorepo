import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { scriptDatabaseConfig } from '../utils/scriptDatabase.js'
import { assertInPersonPinOnLockedRow, FacilityUpdateRejected } from '../src/services/facilityService.js'
import { ErrorCode } from '../src/result.js'

const CONTACT = JSON.stringify({
    phone: '+81355550100',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=fake',
    address: {
        postalCode: '730-0011',
        prefectureEn: 'Hiroshima',
        cityEn: 'Hiroshima',
        addressLine1En: '10-52 Motomachi',
        prefectureJa: '広島県',
        cityJa: '広島市',
        addressLine1Ja: '中区基町10-52'
    }
})

async function insertFacility(
    client: pg.ClientBase,
    online: boolean,
    latitude: number | null,
    longitude: number | null
): Promise<void> {
    await client.query(`
        insert into facilities (
            name_en, name_ja, contact, online, map_latitude, map_longitude, created_date, updated_date,
            payment_options, google_place_id, verification_status, supported_languages
        )
        values ('Pin Test Clinic', 'ピンテストクリニック', $1, $2, $3, $4, now(), now(), '[]', $5, 'UNVERIFIED', '[]')
    `, [CONTACT, online, latitude, longitude, online ? null : `ChIJFakePinRequired${randomUUID().slice(0, 8)}`])
}

/** Runs one insert in its own rolled-back transaction and returns the Postgres error code, if any. */
async function insertError(online: boolean, latitude: number | null, longitude: number | null) {
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()
    await client.query('begin')
    try {
        await insertFacility(client, online, latitude, longitude)
        return undefined
    } catch (error) {
        return (error as { code?: string, constraint?: string })
    } finally {
        await client.query('rollback')
        await client.end()
    }
}

// The #21 import wrote straight to the table and left 1,249 in-person facilities without a pin.
describe('facilities_pin_required', () => {
    it('refuses an in-person facility with no pin, the old 0,0 pin, or a non-finite one', async () => {
        const pins = [[null, null], [34.39, null], [0, 0], [Number.NaN, 132.46], [34.39, Number.POSITIVE_INFINITY]]
        for (const [latitude, longitude] of pins) {
            const error = await insertError(false, latitude, longitude)
            expect(error?.constraint).toBe('facilities_pin_required')
        }
    })

    it('accepts an in-person facility with a pin, and an online one without', async () => {
        expect(await insertError(false, 34.3963, 132.4596)).toBeUndefined()
        expect(await insertError(true, null, null)).toBeUndefined()
    })
})

describe('assertInPersonPinOnLockedRow', () => {
    const pinless = { online: false, map_latitude: null, map_longitude: null }

    it('refuses an edit that leaves an in-person facility without a pin, as a field error', () => {
        let rejected: unknown
        try {
            assertInPersonPinOnLockedRow({ nameEn: 'Corrected Clinic' }, pinless)
        } catch (error) {
            rejected = error
        }

        expect(rejected).toBeInstanceOf(FacilityUpdateRejected)
        const errors = (rejected as FacilityUpdateRejected).result.errors ?? []
        expect(errors.map(error => [error.field, error.errorCode])).toEqual([
            ['mapLatitude', ErrorCode.REQUIRED],
            ['mapLongitude', ErrorCode.REQUIRED]
        ])
    })

    it('accepts the edit once it carries a pin, and any edit to an online facility', () => {
        expect(() => assertInPersonPinOnLockedRow({ mapLatitude: 34.39, mapLongitude: 132.46 }, pinless)).not.toThrow()
        expect(() => assertInPersonPinOnLockedRow({ nameEn: 'Online' }, { ...pinless, online: true })).not.toThrow()
        expect(() => assertInPersonPinOnLockedRow({ online: true }, pinless)).not.toThrow()
    })
})
