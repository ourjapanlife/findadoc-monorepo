import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { Locale, type Facility, type HealthcareProfessional } from '@findadoc/graphql'
import SearchResultDetails from '~/components/search/SearchResultDetails.vue'
import type { FacilitySearchResult } from '~/utils/searchDirectory'

function doctors(count: number): HealthcareProfessional[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `fake-doctor-${index}`,
        slug: `fake-doctor-${index}`,
        names: [{ firstName: `Taro${index}`, lastName: 'Example', locale: Locale.EnUs }],
        degrees: [],
        specialties: [],
        spokenLanguages: [],
        facilityIds: ['fake-clinic']
    }) as unknown as HealthcareProfessional)
}

function clinic(id: string, professionalCount: number): FacilitySearchResult {
    const healthcareProfessionals = doctors(professionalCount)

    return {
        id,
        slug: id,
        nameEn: 'Fake Clinic',
        nameJa: 'フェイククリニック',
        supportedLanguages: [],
        paymentOptions: [],
        healthcareProfessionalIds: healthcareProfessionals.map(professional => professional.id),
        contact: {
            address: { cityEn: 'Minato', cityJa: '港区', prefectureEn: 'Tokyo', prefectureJa: '東京都' }
        },
        healthcareProfessionals
    } as unknown as Facility & { healthcareProfessionals: HealthcareProfessional[] }
}

const ITEM = '[data-testid="search-details-professional"]'
const SHOW_MORE = '[data-testid="search-details-show-more-professionals"]'
const SHOW_ALL = '[data-testid="search-details-show-all-professionals"]'

describe('the doctor list on the clinic details', () => {
    it('shows every doctor and no button when the clinic lists five or fewer', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: clinic('fake-clinic', 5) } })

        expect(wrapper.findAll(ITEM)).toHaveLength(5)
        expect(wrapper.find(SHOW_MORE).exists()).toBe(false)
        expect(wrapper.find(SHOW_ALL).exists()).toBe(false)
    })

    it('shows the first five and reveals five more on each click', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: clinic('fake-clinic', 12) } })

        expect(wrapper.findAll(ITEM)).toHaveLength(5)
        expect(wrapper.find('h3').text()).toBe('12 professionals')
        expect(wrapper.find(SHOW_MORE).text()).toBe('Show 5 more')

        await wrapper.find(SHOW_MORE).trigger('click')
        expect(wrapper.findAll(ITEM)).toHaveLength(10)
        expect(wrapper.find(SHOW_MORE).text()).toBe('Show 2 more')
        expect(wrapper.find(SHOW_ALL).exists()).toBe(false)

        await wrapper.find(SHOW_MORE).trigger('click')
        expect(wrapper.findAll(ITEM)).toHaveLength(12)
        expect(wrapper.find(SHOW_MORE).exists()).toBe(false)
    })

    it('shows every doctor at once from Show all', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: clinic('fake-clinic', 30) } })

        expect(wrapper.find(SHOW_ALL).text()).toBe('Show all 30')
        await wrapper.find(SHOW_ALL).trigger('click')

        expect(wrapper.findAll(ITEM)).toHaveLength(30)
        expect(wrapper.find(SHOW_MORE).exists()).toBe(false)
    })

    it('starts from five again when another clinic opens', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: clinic('fake-clinic', 30) } })
        await wrapper.find(SHOW_ALL).trigger('click')

        await wrapper.setProps({ facility: clinic('other-fake-clinic', 30) })

        expect(wrapper.findAll(ITEM)).toHaveLength(5)
    })
})
