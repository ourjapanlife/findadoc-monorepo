import { describe, expect, it } from 'vitest'
import type { CreateFacilityInput } from '@findadoc/graphql'
import { validateCreateFacility, validateUpdateFacility } from '~/utils/facilitiesUtils'
import type { FacilitySectionFields } from '~/stores/facilitiesStore'

const onlineInput: CreateFacilityInput = {
    nameEn: 'Multilingual online clinic',
    nameJa: '多言語オンラインクリニック',
    online: true,
    contact: {
        phone: '000-0000-0000'
    }
}

const offlineInput: CreateFacilityInput = {
    nameEn: 'Neighborhood clinic',
    nameJa: '近所のクリニック',
    contact: {
        phone: '000-0000-0000',
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
    },
    mapLatitude: 35.68,
    mapLongitude: 139.76
}

function section(online: boolean, map = ''): FacilitySectionFields {
    return {
        nameEn: 'Multilingual online clinic',
        nameJa: '多言語オンラインクリニック',
        phone: '000-0000-0000',
        postalCode: online ? '' : '100-0001',
        prefectureEn: online ? '' : 'Tokyo',
        cityEn: online ? '' : 'Chiyoda',
        addressLine1En: online ? '' : '1-1',
        addressLine2En: '',
        prefectureJa: online ? '' : '東京都',
        cityJa: online ? '' : '千代田区',
        cityId: '',
        addressLine1Ja: online ? '' : '1-1',
        addressLine2Ja: '',
        googlemapsURL: online ? '' : 'https://maps.google.com/?q=tokyo',
        mapLatitude: map,
        mapLongitude: map,
        online,
        healthcareProfessionalIds: [],
        healthProfessionalsRelations: []
    }
}

describe('online facility validation', () => {
    it('accepts an online facility with no address, city, or map', () => {
        expect(validateCreateFacility(onlineInput).valid).toBe(true)
        expect(validateUpdateFacility(section(true), { online: true }).valid).toBe(true)
    })

    it('still requires names and phone when online', () => {
        const missing = validateCreateFacility({
            ...onlineInput,
            nameEn: '',
            contact: { phone: '' }
        })
        expect(missing.valid).toBe(false)
        expect(missing.errors).toEqual([
            'serverErrorMessages.requiredFieldEmpty',
            'serverErrorMessages.requiredFieldEmpty'
        ])
    })

    it('still requires an address, Maps URL, and map pin when the facility is not online', () => {
        expect(validateCreateFacility({
            ...onlineInput,
            online: false
        }).valid).toBe(false)
        expect(validateCreateFacility({
            ...offlineInput,
            contact: { ...offlineInput.contact, googleMapsUrl: '' }
        }).valid).toBe(false)
        expect(validateCreateFacility(offlineInput).valid).toBe(true)
        expect(validateUpdateFacility(section(false), {}).valid).toBe(false)
    })

    it('rejects the zero map placeholder when the facility is not online', () => {
        expect(validateUpdateFacility(section(false, '0'), {}).valid).toBe(false)
        expect(validateUpdateFacility(section(false, '35.68'), {}).valid).toBe(true)
    })

    it('does not require the online flag on a normal create', () => {
        expect(offlineInput.online).toBeUndefined()
        expect(validateCreateFacility(offlineInput).valid).toBe(true)
    })
})
