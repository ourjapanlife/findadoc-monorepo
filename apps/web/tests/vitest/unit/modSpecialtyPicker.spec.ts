import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import enUS from '~/i18n/locales/en.json'
import ModSpecialtyPicker from '~/components/moderation-panel/ModSpecialtyPicker.vue'

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS }, missingWarn: false })

/** Stands in for the search box: exposes what the picker hands it, and lets a test type. */
const SearchBarStub = defineComponent({
    name: 'ModSearchBar',
    props: {
        defaultSuggestions: { type: Array, required: true },
        fieldsToDisplayCallback: { type: Function, required: true }
    },
    emits: ['searchInputChange'],
    template: '<div data-testid="search-bar-stub" />'
})

function mountPicker(selected: Specialty[] = []) {
    return mount(ModSpecialtyPicker, {
        props: { modelValue: selected, testId: 'specialties' },
        global: { plugins: [i18n], stubs: { ModSearchBar: SearchBarStub, ModTokenList: false, ChipTag: false } }
    })
}

describe('ModSpecialtyPicker (#277)', () => {
    it('narrows the list to the picked group, like a city list under a prefecture', async () => {
        const wrapper = mountPicker()
        const bar = wrapper.findComponent(SearchBarStub)

        expect((bar.props('defaultSuggestions') as Specialty[]).length).toBeGreaterThan(50)

        await wrapper.get('[data-testid="specialties-group"]').setValue(SpecialtyCategory.DigestiveHealth)

        expect(bar.props('defaultSuggestions'))
            .toEqual([Specialty.Gastroenterology, Specialty.Hepatology, Specialty.Proctology])
    })

    it('labels each option in English with the Japanese department name', () => {
        const display = mountPicker().findComponent(SearchBarStub).props('fieldsToDisplayCallback') as
            (code: Specialty) => string[]

        expect(display(Specialty.Gastroenterology)).toEqual(['Gastroenterologist · 消化器内科'])
    })

    it('finds a specialty from the department name a clinic lists', () => {
        const bar = mountPicker().findComponent(SearchBarStub)
        const filtered: Ref<Specialty[]> = ref([])

        bar.vm.$emit('searchInputChange', filtered, '胃腸内科')

        expect(filtered.value).toEqual([Specialty.Gastroenterology])
    })

    it('shows selected specialties by name, not by code', () => {
        const wrapper = mountPicker([Specialty.PediatricDentistry])

        expect(wrapper.text()).toContain('Pediatric Dentist')
        expect(wrapper.text()).not.toContain('PEDIATRIC_DENTISTRY')
    })
})
