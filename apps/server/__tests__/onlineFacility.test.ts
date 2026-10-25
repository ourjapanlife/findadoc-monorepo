import { describe, expect, it } from 'vitest'
import { buildFacilityUpdatePatch, contactForStorage } from '../src/services/facilityService.js'
import { hasUsableMapPin, validateCreateFacilityInput } from '../src/validation/validateFacility.js'

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
        expect(patch.map_latitude).toBeNull()
        expect(patch.map_longitude).toBeNull()
        expect(patch.city_id).toBeNull()
        expect(patch.google_place_id).toBeNull()
        expect(patch.verification_status).toBe('UNVERIFIED_LOCATION')
        expect(patch.contact).toEqual({
            phone: '03-0000-0000',
            email: '',
            website: '',
            googleMapsUrl: '',
            address: null
        })
    })

    it('stores a null address when online create omits it', () => {
        expect(contactForStorage({ phone: '03-0000-0000' }, { clearLocation: true })).toEqual({
            phone: '03-0000-0000',
            email: '',
            website: '',
            googleMapsUrl: '',
            address: null
        })
    })
})

describe('map pin requirements', () => {
    it('treats null and 0/0 as unusable pins', () => {
        expect(hasUsableMapPin(null, null)).toBe(false)
        expect(hasUsableMapPin(0, 0)).toBe(false)
        expect(hasUsableMapPin(35.68, 139.76)).toBe(true)
    })

    it('requires Maps URL and map pin when the facility is not online', () => {
        const missingMaps = validateCreateFacilityInput({
            nameEn: 'Neighborhood clinic',
            nameJa: '近所のクリニック',
            contact: {
                phone: '03-0000-0000',
                address: phoneOnlyContact.address
            },
            mapLatitude: 35.68,
            mapLongitude: 139.76
        })
        expect(missingMaps.hasErrors).toBe(true)
        expect(missingMaps.errors?.some(error => error.field === 'contact.googleMapsUrl')).toBe(true)

        const missingPin = validateCreateFacilityInput({
            nameEn: 'Neighborhood clinic',
            nameJa: '近所のクリニック',
            contact: phoneOnlyContact,
            mapLatitude: 0,
            mapLongitude: 0
        })
        expect(missingPin.hasErrors).toBe(true)

        const onlineWithoutMaps = validateCreateFacilityInput({
            nameEn: 'Online clinic',
            nameJa: 'オンラインクリニック',
            online: true,
            contact: { phone: '03-0000-0000' }
        })
        expect(onlineWithoutMaps.hasErrors).toBe(false)
    })
})
