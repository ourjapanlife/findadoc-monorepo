import { describe, expect, it } from 'vitest'
import type { CreateFacilityInput } from '@findadoc/graphql'
import { validateCreateFacility, validateUpdateFacility } from '~/utils/facilitiesUtils'
import type { FacilitySectionFields } from '~/stores/facilitiesStore'

const emptyAddress = {
    postalCode: '',
    prefectureEn: '',
    prefectureJa: '',
    cityEn: '',
    cityJa: '',
    addressLine1En: '',
    addressLine1Ja: '',
    addressLine2En: '',
    addressLine2Ja: ''
}

const onlineInput: CreateFacilityInput = {
    nameEn: 'Multilingual online clinic',
    nameJa: '多言語オンラインクリニック',
    online: true,
    contact: {
        phone: '000-0000-0000',
        googleMapsUrl: '',
        address: emptyAddress
    },
    mapLatitude: 0,
    mapLongitude: 0
}

function section(online: boolean): FacilitySectionFields {
    return {
        nameEn: 'Multilingual online clinic',
        nameJa: '多言語オンラインクリニック',
        phone: '000-0000-0000',
        postalCode: '',
        prefectureEn: '',
        cityEn: '',
        addressLine1En: '',
        addressLine2En: '',
        prefectureJa: '',
        cityJa: '',
        cityId: '',
        addressLine1Ja: '',
        addressLine2Ja: '',
        googlemapsURL: '',
        mapLatitude: '',
        mapLongitude: '',
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

    it('still requires an address when the facility is not online', () => {
        expect(validateCreateFacility({ ...onlineInput, online: false }).valid).toBe(false)
        expect(validateUpdateFacility(section(false), {}).valid).toBe(false)
    })
})
