import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { PaymentType, type Facility, type PaymentOption } from '@findadoc/graphql'
import ModPaymentOptionsField from '~/components/moderation-panel/ModPaymentOptionsField.vue'
import { getChangedFacilityFieldsForUpdate, type FacilitySectionFields } from '~/stores/facilitiesStore'
import {
    changedPaymentOptions,
    formatPaymentOptions,
    togglePaymentBrand,
    togglePaymentType
} from '~/utils/paymentOptions'

// The raw English file: the i18n module compiles an imported locale into message functions.
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const en = JSON.parse(readFileSync(join(rootDir, 'i18n/locales/en.json'), 'utf8')) as {
    paymentOptions: Record<string, Record<string, string>>
}
const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    messages: { 'en-US': { paymentOptions: en.paymentOptions } },
    missingWarn: false,
    fallbackWarn: false
})
const t = (key: string) => i18n.global.t(key)

describe('payment option helpers', () => {
    it('shows nothing for an unknown clinic', () => {
        expect(formatPaymentOptions([], t)).toBe('')
        expect(formatPaymentOptions(null, t)).toBe('')
    })

    it('writes one line in display order with brands in brackets', () => {
        expect(formatPaymentOptions([
            { paymentType: PaymentType.ElectronicMoney, paymentBrands: ['IC'] },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['JCB', 'Visa'] },
            { paymentType: PaymentType.Cash, paymentBrands: [] }
        ], t)).toBe('Cash, Credit card (Visa, JCB), Electronic money (IC card (Suica, PASMO))')
    })

    it('drops a type with its brands, and checking a brand checks its type', () => {
        const withCard = togglePaymentBrand([], PaymentType.CreditCard, 'Visa', true)
        expect(withCard).toEqual([{ paymentType: PaymentType.CreditCard, paymentBrands: ['Visa'] }])
        expect(togglePaymentType(withCard, PaymentType.CreditCard, false)).toEqual([])
    })

    it('keeps the type when its last brand is unchecked', () => {
        const withCard = [{ paymentType: PaymentType.CreditCard, paymentBrands: ['Visa'] }]
        expect(togglePaymentBrand(withCard, PaymentType.CreditCard, 'Visa', false))
            .toEqual([{ paymentType: PaymentType.CreditCard, paymentBrands: [] }])
    })

    it('sends nothing when only the order changed', () => {
        const saved = [
            { paymentType: PaymentType.CreditCard, paymentBrands: ['JCB', 'Visa'] },
            { paymentType: PaymentType.Cash, paymentBrands: null }
        ]
        const draft = [
            { paymentType: PaymentType.Cash, paymentBrands: [] },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'JCB'] }
        ]
        expect(changedPaymentOptions(draft, saved)).toBeNull()
        expect(changedPaymentOptions([], saved)).toEqual([])
    })
})

describe('facility update with payment', () => {
    const original = {
        id: 'facility-1',
        nameEn: 'Fake Clinic',
        nameJa: 'フェイククリニック',
        online: true,
        contact: { phone: '', email: '', website: '', googleMapsUrl: '' },
        healthcareProfessionalIds: [],
        japaneseInsurance: null,
        japaneseInsuranceSource: null,
        paymentOptions: []
    } as unknown as Facility

    function section(paymentOptions: PaymentOption[]): FacilitySectionFields {
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
            paymentOptions,
            healthcareProfessionalIds: [],
            healthProfessionalsRelations: []
        }
    }

    it('leaves payment out when the moderator did not change it', () => {
        expect(getChangedFacilityFieldsForUpdate(section([]), original)).not.toHaveProperty('paymentOptions')
    })

    it('sends the new list when the moderator adds a type', () => {
        const changed = getChangedFacilityFieldsForUpdate(
            section([{ paymentType: PaymentType.Cash, paymentBrands: [] }]),
            original
        )
        expect(changed.paymentOptions).toEqual([{ paymentType: PaymentType.Cash, paymentBrands: [] }])
    })
})

describe('ModPaymentOptionsField', () => {
    function mountField(modelValue: PaymentOption[]) {
        const wrapper = mount(ModPaymentOptionsField, {
            props: {
                modelValue,
                'onUpdate:modelValue': (value: PaymentOption[]) => wrapper.setProps({ modelValue: value })
            },
            global: { plugins: [i18n] }
        })
        return wrapper
    }

    it('starts with nothing checked and no brands shown', () => {
        const wrapper = mountField([])
        const cash = wrapper.get<HTMLInputElement>('[data-testid="mod-facility-section-payment-CASH"]')
        expect(cash.element.checked).toBe(false)
        expect(wrapper.find('[data-testid="mod-facility-section-payment-CREDIT_CARD-Visa"]').exists()).toBe(false)
    })

    it('shows card brands once credit card is checked', async () => {
        const wrapper = mountField([])
        await wrapper.get('[data-testid="mod-facility-section-payment-CREDIT_CARD"]').setValue(true)
        expect(wrapper.props('modelValue')).toEqual([{ paymentType: PaymentType.CreditCard, paymentBrands: [] }])

        await wrapper.get('[data-testid="mod-facility-section-payment-CREDIT_CARD-JCB"]').setValue(true)
        expect(wrapper.props('modelValue')).toEqual([{ paymentType: PaymentType.CreditCard, paymentBrands: ['JCB'] }])
    })
})
