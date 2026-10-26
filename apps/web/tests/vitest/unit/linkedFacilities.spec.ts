/// <reference types="vitest/globals" />
import { defineComponent, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { expect } from 'chai'
import ModLinkedFacilities from '~/components/moderation-panel/ModLinkedFacilities.vue'
import {
    addFacilityLink,
    facilitiesForIds,
    facilityLinkLabel,
    removeFacilityLink
} from '~/utils/linkedFacilities'

describe('linked facilities', () => {
    it('keeps a clinic that is not on the current page and labels it by name', () => {
        const known = new Map([
            ['clinic-on-page', { id: 'clinic-on-page', nameEn: 'Page Clinic', nameJa: 'ページ' }],
            ['clinic-off-page', { id: 'clinic-off-page', nameEn: 'Harbor Clinic', nameJa: '港クリニック' }]
        ])

        const linked = facilitiesForIds(['clinic-off-page', 'clinic-on-page'], known)
        const harbor = linked[0]
        if (harbor === undefined) {
            throw new Error('expected the off-page clinic')
        }

        expect(linked.map(facility => facility.id)).to.deep.equal(['clinic-off-page', 'clinic-on-page'])
        expect(facilityLinkLabel(harbor)).to.equal('Harbor Clinic · 港クリニック')
    })

    it('falls back to the id until a name is known', () => {
        const linked = facilitiesForIds(['missing-clinic'], new Map())
        const missing = linked[0]
        if (missing === undefined) {
            throw new Error('expected the missing clinic')
        }

        expect(facilityLinkLabel(missing)).to.equal('missing-clinic')
    })

    it('adds a link once and removes it by id', () => {
        const added = addFacilityLink(['clinic-a', 'clinic-a'], 'clinic-b')

        expect(added).to.deep.equal(['clinic-a', 'clinic-b'])
        expect(removeFacilityLink(added, 'clinic-a')).to.deep.equal(['clinic-b'])
    })

    it('shows a linked clinic that the page list does not contain', async () => {
        const ids = ref(['clinic-off-page'])
        const Host = defineComponent({
            components: { ModLinkedFacilities },
            setup() {
                return { ids }
            },
            template: `
                <ModLinkedFacilities
                    v-model="ids"
                    :suggestions="[]"
                    place-holder-text="Search"
                    no-match-text="None"
                    empty-text="No facilities"
                    :remove-label="removeLabel"
                    :load-facilities="loadFacilities"
                />
            `,
            methods: {
                removeLabel: (name: string) => `Remove ${name}`,
                loadFacilities: async () => [{
                    id: 'clinic-off-page',
                    nameEn: 'Harbor Clinic',
                    nameJa: '港クリニック'
                }]
            }
        })

        const wrapper = mount(Host)
        await flushPromises()

        expect(wrapper.get('[data-testid="linked-facilities"]').text()).to.include('Harbor Clinic')
        expect(wrapper.get('[data-testid="linked-facility-remove"]').classes()).to.include('mod-edit-only')

        await wrapper.get('[data-testid="linked-facility-remove"]').trigger('click')

        expect(ids.value).to.deep.equal([])
        expect(wrapper.find('[data-testid="linked-facilities"]').exists()).to.equal(false)
    })

    it('links a facility picked from the search results and unlinks it on a second pick', async () => {
        const ids = ref<string[]>([])
        const Host = defineComponent({
            components: { ModLinkedFacilities },
            setup() {
                return {
                    ids,
                    suggestions: [{ id: 'clinic-1', nameEn: 'Harbor Clinic', nameJa: '港クリニック' }]
                }
            },
            template: `
                <ModLinkedFacilities
                    v-model="ids"
                    :suggestions="suggestions"
                    place-holder-text="Search"
                    no-match-text="None"
                    empty-text="No facilities"
                    :remove-label="removeLabel"
                    :load-facilities="loadFacilities"
                />
            `,
            methods: {
                removeLabel: (name: string) => `Remove ${name}`,
                loadFacilities: async () => []
            }
        })
        const wrapper = mount(Host, { attachTo: document.body })
        const result = () => document.body.querySelector<HTMLElement>('[data-testid="mod-search-bar-search-result"]')

        await wrapper.get('input').trigger('focus')
        result()?.click()
        await flushPromises()

        expect(ids.value).to.deep.equal(['clinic-1'])
        expect(wrapper.get('[data-testid="linked-facilities"]').text()).to.include('Harbor Clinic')
        expect(wrapper.get('[data-testid="linked-facilities"]').text()).to.include('港クリニック')

        result()?.click()
        await flushPromises()

        expect(ids.value).to.deep.equal([])
        wrapper.unmount()
    })
})
