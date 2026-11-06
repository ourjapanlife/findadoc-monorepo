import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { JapaneseInsurance } from '@findadoc/graphql'
import ModJapaneseInsuranceField from '~/components/moderation-panel/ModJapaneseInsuranceField.vue'
import type { JapaneseInsuranceChoice } from '~/utils/japaneseInsurance'

const i18n = createI18n({ legacy: false, locale: 'en-US', missingWarn: false, fallbackWarn: false })

function mountField(choice: JapaneseInsuranceChoice, source: string) {
    const wrapper = mount(ModJapaneseInsuranceField, {
        props: {
            choice,
            source,
            'onUpdate:choice': (value: JapaneseInsuranceChoice) => wrapper.setProps({ choice: value }),
            'onUpdate:source': (value: string) => wrapper.setProps({ source: value })
        },
        global: { plugins: [i18n], stubs: { ModInputField: true } }
    })
    return wrapper
}

describe('ModJapaneseInsuranceField', () => {
    it('offers unknown, takes it, and does not take it', () => {
        const wrapper = mountField('', '')

        expect(wrapper.find('[data-testid="mod-facility-section-japanese-insurance-unknown"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="mod-facility-section-japanese-insurance-accepted"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="mod-facility-section-japanese-insurance-not-accepted"]').exists())
            .toBe(true)
    })

    it('keeps the source note when the moderator switches away and back to self-pay only', async () => {
        const wrapper = mountField(JapaneseInsurance.NotAccepted, 'https://clinic.example/insurance')

        await wrapper.get('[data-testid="mod-facility-section-japanese-insurance-unknown"]').setValue()
        expect(wrapper.props('choice')).toBe('')
        expect(wrapper.find('[data-testid="mod-facility-section-japanese-insurance-source"]').exists()).toBe(false)

        await wrapper.get('[data-testid="mod-facility-section-japanese-insurance-not-accepted"]').setValue()
        expect(wrapper.props('choice')).toBe(JapaneseInsurance.NotAccepted)
        expect(wrapper.props('source')).toBe('https://clinic.example/insurance')
        expect(wrapper.find('[data-testid="mod-facility-section-japanese-insurance-source"]').exists()).toBe(true)
    })
})
