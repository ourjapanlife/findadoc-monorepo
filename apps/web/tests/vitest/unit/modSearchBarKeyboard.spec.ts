/// <reference types="vitest/globals" />
import { defineComponent, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { expect } from 'chai'
import { createI18n } from 'vue-i18n'
import enUS from '~/i18n/locales/en.json'
import ModSearchBar from '~/components/moderation-panel/ModSearchBar.vue'
import ModInputField from '~/components/moderation-panel/ModInputField.vue'

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS }, missingWarn: false })
const LANGUAGES = ['en_US', 'ja_JP', 'fr_FR']

function mountLanguagePicker() {
    const selected = ref<string[]>([])
    const Host = defineComponent({
        components: { ModSearchBar },
        setup() {
            return { selected, languages: LANGUAGES, display: (code: string) => [code] }
        },
        template: `
            <div>
                <label for="locales">Spoken languages</label>
                <ModSearchBar
                    v-model="selected"
                    input-id="locales"
                    place-holder-text="Search languages"
                    no-match-text="None"
                    :fields-to-display-callback="display"
                    :default-suggestions="languages"
                />
            </div>
        `
    })
    const wrapper = mount(Host, { attachTo: document.body })
    return { wrapper, selected }
}

describe('moderation search picker keyboard use', () => {
    beforeAll(() => {
        // jsdom has no layout, so it has no scrollIntoView for the highlighted option
        Element.prototype.scrollIntoView = vi.fn()
    })

    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('is named by its field label and announces itself as a combobox', () => {
        const { wrapper } = mountLanguagePicker()
        const input = wrapper.get('input')

        expect(input.attributes('id')).to.equal('locales')
        expect(input.attributes('role')).to.equal('combobox')
        expect(input.attributes('aria-expanded')).to.equal('false')
        wrapper.unmount()
    })

    it('has one tab stop: the search icon is not tabbable and options never take focus', async () => {
        const { wrapper } = mountLanguagePicker()

        expect(wrapper.get('button').attributes('tabindex')).to.equal('-1')

        await wrapper.get('input').trigger('focus')
        const options = [...document.body.querySelectorAll('[data-testid="mod-search-bar-search-result"]')]

        expect(options).to.have.length(LANGUAGES.length)
        for (const option of options) {
            expect(option.getAttribute('role')).to.equal('option')
            expect(option.hasAttribute('tabindex')).to.equal(false)
        }
        wrapper.unmount()
    })

    it('picks a language with the arrow keys and Enter, and marks the highlighted option', async () => {
        const { wrapper, selected } = mountLanguagePicker()
        const input = wrapper.get('input')

        await input.trigger('focus')
        expect(input.attributes('aria-expanded')).to.equal('true')

        await input.trigger('keydown', { key: 'ArrowDown' })
        const activeId = input.attributes('aria-activedescendant')
        const active = activeId === undefined ? null : document.getElementById(activeId)
        expect(active?.textContent).to.include('ja_JP')

        await input.trigger('keydown', { key: 'Enter' })
        await flushPromises()

        expect(selected.value).to.deep.equal(['ja_JP'])
        expect(active?.getAttribute('aria-selected')).to.equal('true')
        wrapper.unmount()
    })
})

describe('moderation text field', () => {
    it('links its label to the input', () => {
        const wrapper = mount(ModInputField, {
            props: { label: 'Facility name', type: 'text', placeholder: '', required: true },
            global: { plugins: [i18n] }
        })
        const id = wrapper.get('input').attributes('id')

        expect(id).to.be.a('string').and.not.equal('')
        expect(wrapper.get('label').attributes('for')).to.equal(id)
    })
})
