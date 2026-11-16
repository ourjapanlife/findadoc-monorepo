import { describe, expect, it } from 'vitest'
import { JapaneseInsurance, type Facility } from '@findadoc/graphql'
import { getChangedFacilityFieldsForUpdate, type FacilitySectionFields } from '~/stores/facilitiesStore'
import {
    isValidJapaneseInsuranceSource,
    japaneseInsuranceChoice,
    japaneseInsuranceInput
} from '~/utils/japaneseInsurance'

const original = {
    id: 'facility-1',
    nameEn: 'Minato Clinic',
    nameJa: '港クリニック',
    online: true,
    contact: { phone: '03-0000-0000', email: '', website: '', googleMapsUrl: '' },
    healthcareProfessionalIds: [],
    japaneseInsurance: null,
    japaneseInsuranceSource: null
} as unknown as Facility

function section(fields: Partial<FacilitySectionFields>): FacilitySectionFields {
    return {
        nameEn: 'Minato Clinic',
        nameJa: '港クリニック',
        phone: '03-0000-0000',
        email: '',
        website: '',
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
        online: true,
        japaneseInsurance: '',
        japaneseInsuranceSource: '',
        paymentOptions: [],
        healthcareProfessionalIds: [],
        healthProfessionalsRelations: [],
        ...fields
    }
}

describe('japanese insurance helpers', () => {
    it('treats unknown as having no source', () => {
        expect(japaneseInsuranceInput('', 'https://ignored.test')).toEqual({
            japaneseInsurance: null,
            japaneseInsuranceSource: null
        })
    })

    it('keeps a source only on a self-pay-only answer, like the API', () => {
        expect(japaneseInsuranceInput(JapaneseInsurance.NotAccepted, ' https://clinic.example/insurance ')).toEqual({
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            japaneseInsuranceSource: 'https://clinic.example/insurance'
        })
        expect(japaneseInsuranceInput(JapaneseInsurance.Accepted, 'https://clinic.test')).toEqual({
            japaneseInsurance: JapaneseInsurance.Accepted,
            japaneseInsuranceSource: null
        })
    })

    it('takes an empty source, a link, or a note', () => {
        expect(isValidJapaneseInsuranceSource('')).toBe(true)
        expect(isValidJapaneseInsuranceSource('https://clinic.example/insurance')).toBe(true)
        expect(isValidJapaneseInsuranceSource('Called the clinic on 2 Nov 2026')).toBe(true)
        expect(isValidJapaneseInsuranceSource('x'.repeat(501))).toBe(false)
    })

    it('reads an unknown stored value as unknown', () => {
        expect(japaneseInsuranceChoice(null)).toBe('')
        expect(japaneseInsuranceChoice(JapaneseInsurance.Accepted)).toBe(JapaneseInsurance.Accepted)
    })
})

describe('facility update diff', () => {
    it('sends nothing for a stored yes with no source', () => {
        const stored = { ...original, japaneseInsurance: JapaneseInsurance.Accepted } as Facility
        const update = getChangedFacilityFieldsForUpdate(section({ japaneseInsurance: JapaneseInsurance.Accepted }), stored)
        expect(update.japaneseInsurance).toBeUndefined()
    })

    it('sends nothing when the answer did not change', () => {
        const update = getChangedFacilityFieldsForUpdate(section({}), original)
        expect(update.japaneseInsurance).toBeUndefined()
        expect(update.japaneseInsuranceSource).toBeUndefined()
    })

    it('sends the answer with its source', () => {
        const update = getChangedFacilityFieldsForUpdate(section({
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            japaneseInsuranceSource: ' https://clinic.example/insurance '
        }), original)
        expect(update.japaneseInsurance).toBe(JapaneseInsurance.NotAccepted)
        expect(update.japaneseInsuranceSource).toBe('https://clinic.example/insurance')
    })

    it('clears both when the moderator goes back to unknown', () => {
        const answered = {
            ...original,
            japaneseInsurance: JapaneseInsurance.Accepted,
            japaneseInsuranceSource: 'https://clinic.test'
        } as Facility
        const update = getChangedFacilityFieldsForUpdate(section({}), answered)
        expect(update.japaneseInsurance).toBeNull()
        expect(update.japaneseInsuranceSource).toBeNull()
    })
})
