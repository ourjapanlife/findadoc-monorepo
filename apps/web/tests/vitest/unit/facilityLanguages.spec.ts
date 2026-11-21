import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { Locale, type Facility } from '@findadoc/graphql'
import ModSupportedLanguagesField from '~/components/moderation-panel/ModSupportedLanguagesField.vue'
import { getChangedFacilityFieldsForUpdate, type FacilitySectionFields } from '~/stores/facilitiesStore'
import { changedSupportedLanguages, toggleSupportedLanguage } from '~/utils/facilityLanguages'

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

const OPTIONS = [Locale.EnUs, Locale.JaJp, Locale.ZhCn]

describe('facility language helpers', () => {
    it('keeps the option order when a language is checked', () => {
        expect(toggleSupportedLanguage([Locale.ZhCn], Locale.EnUs, true, OPTIONS)).toEqual([Locale.EnUs, Locale.ZhCn])
    })

    it('drops a language when it is unchecked', () => {
        expect(toggleSupportedLanguage([Locale.EnUs, Locale.JaJp], Locale.EnUs, false, OPTIONS)).toEqual([Locale.JaJp])
    })

    it('reports no change when only the order differs', () => {
        expect(changedSupportedLanguages([Locale.JaJp, Locale.EnUs], [Locale.EnUs, Locale.JaJp])).toBeUndefined()
        expect(changedSupportedLanguages([], null)).toBeUndefined()
    })

    it('sends an empty list when every language is removed', () => {
        expect(changedSupportedLanguages([], [Locale.EnUs])).toEqual([])
    })
})

describe('facility update with languages', () => {
    const original = {
        id: 'facility-1',
        nameEn: 'Fake Clinic',
        nameJa: 'フェイククリニック',
        online: true,
        contact: { phone: '', email: '', website: '', googleMapsUrl: '' },
        healthcareProfessionalIds: [],
        japaneseInsurance: null,
        japaneseInsuranceSource: null,
        paymentOptions: [],
        supportedLanguages: [Locale.EnUs]
    } as unknown as Facility

    function section(supportedLanguages: Locale[]): FacilitySectionFields {
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
            supportedLanguages,
            healthcareProfessionalIds: [],
            healthProfessionalsRelations: []
        }
    }

    it('leaves languages out when the moderator did not change them', () => {
        expect(getChangedFacilityFieldsForUpdate(section([Locale.EnUs]), original))
            .not.toHaveProperty('supportedLanguages')
    })

    it('sends the new list when the moderator adds a language', () => {
        const changed = getChangedFacilityFieldsForUpdate(section([Locale.EnUs, Locale.ZhCn]), original)
        expect(changed.supportedLanguages).toEqual([Locale.EnUs, Locale.ZhCn])
    })
})

describe('ModSupportedLanguagesField', () => {
    function mountField(modelValue: Locale[]) {
        const wrapper = mount(ModSupportedLanguagesField, {
            props: {
                modelValue,
                'onUpdate:modelValue': (value: Locale[]) => wrapper.setProps({ modelValue: value })
            },
            global: { plugins: [i18n] }
        })
        return wrapper
    }

    it('offers the published languages with nothing checked', () => {
        const wrapper = mountField([])
        const english = wrapper.get<HTMLInputElement>('[data-testid="mod-facility-section-language-en_US"]')
        expect(english.element.checked).toBe(false)
        expect(wrapper.find('[data-testid="mod-facility-section-language-ja_JP"]').exists()).toBe(true)
    })

    it('updates the list when a language is checked', async () => {
        const wrapper = mountField([Locale.JaJp])
        await wrapper.get('[data-testid="mod-facility-section-language-en_US"]').setValue(true)
        expect(wrapper.props('modelValue')).toEqual([Locale.EnUs, Locale.JaJp])
    })
})
