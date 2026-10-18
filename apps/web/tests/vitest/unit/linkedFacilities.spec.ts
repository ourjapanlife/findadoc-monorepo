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

        expect(linked.map(facility => facility.id)).to.deep.equal(['clinic-off-page', 'clinic-on-page'])
        expect(facilityLinkLabel(linked[0])).to.equal('Harbor Clinic · 港クリニック')
    })

    it('falls back to the id until a name is known', () => {
        const linked = facilitiesForIds(['missing-clinic'], new Map())

        expect(facilityLinkLabel(linked[0])).to.equal('missing-clinic')
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
})
