/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { expect } from 'chai'
import ModSearchBar from '~/components/moderation-panel/ModSearchBar.vue'
import { provideModerationFormEditing } from '~/composables/useModerationFormMode'
import { searchResultMenuBox } from '~/utils/searchResultMenu'

const viewport = { width: 1200, height: 800 }

describe('searchResultMenuBox', () => {
    it('opens below a field that has room, at the field width', () => {
        const box = searchResultMenuBox(
            { top: 100, bottom: 148, left: 40, width: 320 },
            viewport.width,
            viewport.height
        )

        expect(box.top).to.equal(152)
        expect(box.bottom).to.equal(null)
        expect(box.left).to.equal(40)
        expect(box.width).to.equal(320)
        expect(box.maxHeight).to.equal(256)
    })

    it('opens above a field in the lower third when that side has more room', () => {
        const box = searchResultMenuBox(
            { top: 700, bottom: 748, left: 40, width: 320 },
            viewport.width,
            viewport.height
        )

        expect(box.top).to.equal(null)
        expect(box.bottom).to.equal(104)
        expect(box.maxHeight).to.be.greaterThan(0)
        expect(box.maxHeight).to.be.at.most(256)
    })

    it('keeps a wide field inside the viewport', () => {
        const box = searchResultMenuBox(
            { top: 100, bottom: 148, left: 1100, width: 400 },
            viewport.width,
            viewport.height
        )

        expect(box.left + box.width).to.be.at.most(viewport.width - 8)
        expect(box.width).to.be.at.most(viewport.width - 16)
    })
})

describe('ModSearchBar results', () => {
    it('renders the open menu on the document, outside an overflow-hidden parent', async () => {
        const parent = document.createElement('div')
        parent.style.overflow = 'hidden'
        document.body.appendChild(parent)
        const wrapper = mount(ModSearchBar, {
            props: {
                modelValue: [],
                placeHolderText: 'Clinics',
                noMatchText: 'None',
                fieldsToDisplayCallback: (item: { name: string }) => [item.name],
                defaultSuggestions: [{ id: 'clinic-1', name: 'Minato Dental' }]
            },
            attachTo: parent
        })

        await wrapper.find('input').trigger('focus')

        const menu = document.body.querySelector('ul.fixed')
        expect(menu, 'menu').to.not.equal(null)
        expect(parent.contains(menu)).to.equal(false)
        wrapper.unmount()
        parent.remove()
    })

    it('does not accept a search while the form is in preview', async () => {
        const selected = ref<Array<{ id: string, name: string }>>([])
        const PreviewHost = defineComponent({
            components: { ModSearchBar },
            setup() {
                provideModerationFormEditing(false)
                const label = (item: { name: string }) => [item.name]
                return {
                    selected,
                    label,
                    suggestions: [{ id: 'clinic-1', name: 'Minato Dental' }]
                }
            },
            template: `<ModSearchBar
                v-model="selected"
                place-holder-text="Clinics"
                no-match-text="None"
                :fields-to-display-callback="label"
                :default-suggestions="suggestions"
            />`
        })
        const wrapper = mount(PreviewHost, { attachTo: document.body })
        const input = wrapper.get('input')
        expect((input.element as HTMLInputElement).disabled).to.equal(true)
        await input.trigger('focus')
        expect(document.body.querySelector('ul.fixed')).to.equal(null)
        expect(selected.value).to.deep.equal([])
        wrapper.unmount()
    })

    it('removes a clinic when a later search returns the same id on a new object', async () => {
        const selected = ref<Array<{ id: string, name: string }>>([])
        const suggestions = ref([{ id: 'clinic-1', name: 'Minato Dental' }])
        const Host = defineComponent({
            components: { ModSearchBar },
            setup() {
                const label = (item: { name: string }) => [item.name]
                return { selected, suggestions, label }
            },
            template: `<ModSearchBar
                v-model="selected"
                place-holder-text="Clinics"
                no-match-text="None"
                :fields-to-display-callback="label"
                :default-suggestions="suggestions"
            />`
        })
        const wrapper = mount(Host, { attachTo: document.body })
        const result = () => document.body.querySelector<HTMLElement>('[data-testid="mod-search-bar-search-result"]')

        await wrapper.find('input').trigger('focus')
        result()?.click()
        await wrapper.vm.$nextTick()
        expect(selected.value.map(item => item.id)).to.deep.equal(['clinic-1'])

        suggestions.value = [{ id: 'clinic-1', name: 'Minato Dental' }]
        await wrapper.find('input').trigger('focus')
        result()?.click()
        await wrapper.vm.$nextTick()
        expect(selected.value).to.deep.equal([])
        wrapper.unmount()
    })
})

describe('preview edit controls', () => {
    it('hides edit-only controls from the utilities layer so flex cannot keep them visible', () => {
        const css = readFileSync(resolve(process.cwd(), 'assets/css/tailwind.css'), 'utf8')
        const utilities = css.slice(css.indexOf('@layer utilities'))
        expect(utilities).to.include("[data-mod-mode='preview'] .mod-edit-only")
        expect(utilities).to.include('display: none')
    })
})
