import { describe, expect, it } from 'vitest'
import { buildFacilityUpdatePatch, contactForStorage } from '../src/services/facilityService.js'

const phoneOnlyContact = {
    phone: '03-0000-0000',
    email: '',
    website: '',
    googleMapsUrl: 'https://maps.google.com/?q=tokyo',
    address: {
        postalCode: '100-0001',
        prefectureEn: 'Tokyo',
        cityEn: 'Chiyoda',
        addressLine1En: '1-1',
        addressLine2En: '',
        prefectureJa: '東京都',
        cityJa: '千代田区',
        addressLine1Ja: '1-1',
        addressLine2Ja: ''
    }
}

describe('online facility updates', () => {
    it('stores the online flag without requiring it on every update', () => {
        expect(buildFacilityUpdatePatch({ online: true }, phoneOnlyContact).online).toBe(true)
        expect(buildFacilityUpdatePatch({ online: false }).online).toBe(false)
        expect(buildFacilityUpdatePatch({})).not.toHaveProperty('online')
    })

    it('clears address, city, and map when a facility becomes online', () => {
        const patch = buildFacilityUpdatePatch({ online: true }, phoneOnlyContact)
        expect(patch.map_latitude).toBe(0)
        expect(patch.map_longitude).toBe(0)
        expect(patch.city_id).toBeNull()
        expect(patch.google_place_id).toBeNull()
        expect(patch.verification_status).toBe('UNVERIFIED_LOCATION')
        expect(patch.contact).toEqual({
            phone: '03-0000-0000',
            email: '',
            website: '',
            googleMapsUrl: '',
            address: {
                postalCode: '',
                prefectureEn: '',
                cityEn: '',
                addressLine1En: '',
                addressLine2En: '',
                prefectureJa: '',
                cityJa: '',
                addressLine1Ja: '',
                addressLine2Ja: ''
            }
        })
    })

    it('fills a blank address when online create omits it', () => {
        expect(contactForStorage({ phone: '03-0000-0000' }, { clearLocation: true })).toEqual({
            phone: '03-0000-0000',
            email: '',
            website: '',
            googleMapsUrl: '',
            address: {
                postalCode: '',
                prefectureEn: '',
                cityEn: '',
                addressLine1En: '',
                addressLine2En: '',
                prefectureJa: '',
                cityJa: '',
                addressLine1Ja: '',
                addressLine2Ja: ''
            }
        })
    })
})
