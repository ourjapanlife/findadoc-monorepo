import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { FacilityVerificationStatus, type Facility } from '@findadoc/graphql'
import ModFacilityVerificationField from '~/components/moderation-panel/ModFacilityVerificationField.vue'
import { getChangedFacilityFieldsForUpdate, type FacilitySectionFields } from '~/stores/facilitiesStore'
import {
    changedVerificationStatus,
    facilityVerificationChoice,
    type FacilityVerificationChoice
} from '~/utils/facilityVerification'

// The raw English file: the i18n module compiles an imported locale into message functions.
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const en = JSON.parse(readFileSync(join(rootDir, 'i18n/locales/en.json'), 'utf8')) as {
    modFacilitySection: Record<string, string>
}
const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    messages: { 'en-US': { modFacilitySection: en.modFacilitySection } },
    missingWarn: false,
    fallbackWarn: false
})

const CITY = '00000000-0000-4000-8000-000000000001'
const OTHER_CITY = '00000000-0000-4000-8000-000000000002'
const { Confirmed, Unverified, UnverifiedLocation } = FacilityVerificationStatus

describe('facility verification helpers', () => {
    it('starts every status but confirmed as unverified', () => {
        expect(facilityVerificationChoice(Confirmed)).toBe(Confirmed)
        expect(facilityVerificationChoice(UnverifiedLocation)).toBe(Unverified)
        expect(facilityVerificationChoice(null)).toBe(Unverified)
    })

    it('sends confirmed when the moderator confirms a facility with a city', () => {
        expect(changedVerificationStatus(Confirmed, CITY, { verificationStatus: Unverified, cityId: CITY }))
            .toBe(Confirmed)
    })

    it('sends nothing when the choice and the city are unchanged', () => {
        expect(changedVerificationStatus(Confirmed, CITY, { verificationStatus: Confirmed, cityId: CITY }))
            .toBeUndefined()
    })

    it('sends nothing without a city, so the API keeps the location unverified', () => {
        expect(changedVerificationStatus(Confirmed, ' ', { verificationStatus: UnverifiedLocation, cityId: null }))
            .toBeUndefined()
    })

    it('resends the choice when the city changes, so a confirmed facility stays confirmed', () => {
        expect(changedVerificationStatus(Confirmed, OTHER_CITY, { verificationStatus: Confirmed, cityId: CITY }))
            .toBe(Confirmed)
    })
})

describe('facility update with verification', () => {
    const original = {
        id: 'facility-1',
        nameEn: 'Fake Clinic',
        nameJa: 'フェイククリニック',
        online: false,
        cityId: CITY,
        verificationStatus: Unverified,
        mapLatitude: 26.3,
        mapLongitude: 127.8,
        contact: {
            phone: '',
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
        },
        healthcareProfessionalIds: [],
        japaneseInsurance: null,
        japaneseInsuranceSource: null,
        paymentOptions: []
    } as unknown as Facility

    function section(verificationStatus: FacilityVerificationChoice): FacilitySectionFields {
        return {
            nameEn: 'Fake Clinic',
            nameJa: 'フェイククリニック',
            phone: '',
            email: '',
            website: '',
            postalCode: '',
            prefectureEn: '',
            cityEn: '',
            addressLine1En: '',
            addressLine2En: '',
            prefectureJa: '',
            cityJa: '',
            cityId: CITY,
            addressLine1Ja: '',
            addressLine2Ja: '',
            googlemapsURL: '',
            mapLatitude: '26.3',
            mapLongitude: '127.8',
            online: false,
            japaneseInsurance: '',
            japaneseInsuranceSource: '',
            paymentOptions: [],
            openingHours: [],
            additionalInfoEn: '',
            additionalInfoJa: '',
            supportedLanguages: [],
            verificationStatus,
            healthcareProfessionalIds: [],
            healthProfessionalsRelations: []
        }
    }

    it('leaves the status out when the moderator did not change it', () => {
        expect(getChangedFacilityFieldsForUpdate(section(Unverified), original)).not.toHaveProperty('verificationStatus')
    })

    it('sends confirmed when the moderator confirms the facility', () => {
        expect(getChangedFacilityFieldsForUpdate(section(Confirmed), original).verificationStatus).toBe(Confirmed)
    })
})

describe('ModFacilityVerificationField', () => {
    function mountField(modelValue: FacilityVerificationChoice, hasCity: boolean) {
        const wrapper = mount(ModFacilityVerificationField, {
            props: {
                modelValue,
                hasCity,
                'onUpdate:modelValue': (value: FacilityVerificationChoice) => wrapper.setProps({ modelValue: value })
            },
            global: { plugins: [i18n] }
        })
        return wrapper
    }

    it('lets the moderator confirm a facility that has a city', async () => {
        const wrapper = mountField(Unverified, true)
        await wrapper.get('[data-testid="mod-facility-section-verification-confirmed"]').setValue(true)
        expect(wrapper.props('modelValue')).toBe(Confirmed)
    })

    it('disables confirmed and explains why when there is no city', () => {
        const wrapper = mountField(Unverified, false)
        const confirmed = wrapper.get<HTMLInputElement>('[data-testid="mod-facility-section-verification-confirmed"]')
        expect(confirmed.element.disabled).toBe(true)
        expect(wrapper.find('[data-testid="mod-facility-section-verification-needs-city"]').exists()).toBe(true)
    })

    it('drops the confirmation when the city is cleared', async () => {
        const wrapper = mountField(Confirmed, true)
        await wrapper.setProps({ hasCity: false })
        expect(wrapper.props('modelValue')).toBe(Unverified)
    })
})
