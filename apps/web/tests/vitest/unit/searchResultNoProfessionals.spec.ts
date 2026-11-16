import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { Locale, type Facility, type HealthcareProfessional } from '@findadoc/graphql'
import SearchResultCard from '~/components/search/SearchResultCard.vue'
import SearchResultDetails from '~/components/search/SearchResultDetails.vue'
import type { FacilitySearchResult } from '~/utils/searchDirectory'

function result(healthcareProfessionals: HealthcareProfessional[]): FacilitySearchResult {
    return {
        id: 'fake-clinic',
        slug: 'fake-clinic',
        nameEn: 'Fake Clinic',
        nameJa: 'フェイククリニック',
        supportedLanguages: [Locale.EnUs],
        paymentOptions: [],
        healthcareProfessionalIds: healthcareProfessionals.map(professional => professional.id),
        contact: {
            address: { cityEn: 'Minato', cityJa: '港区', prefectureEn: 'Tokyo', prefectureJa: '東京都' }
        },
        healthcareProfessionals
    } as unknown as Facility & { healthcareProfessionals: HealthcareProfessional[] }
}

const doctor = {
    id: 'fake-doctor',
    slug: 'fake-doctor',
    names: [{ firstName: 'Taro', lastName: 'Example', locale: Locale.EnUs }],
    degrees: [],
    specialties: [],
    spokenLanguages: [Locale.EnUs],
    facilityIds: ['fake-clinic']
} as unknown as HealthcareProfessional

describe('a clinic with no listed doctor (#21)', () => {
    it('says on the search card that no doctors are listed yet', async () => {
        const wrapper = await mountSuspended(SearchResultCard, { props: { result: result([]), from: 'results' } })

        expect(wrapper.find('[data-testid="search-result-no-professionals"]').text()).toBe('No doctors listed yet')
    })

    it('explains on the clinic details that we have no doctor data, and links to adding one', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: result([]) } })

        const note = wrapper.find('[data-testid="search-details-no-professionals"]')
        expect(note.exists()).toBe(true)
        expect(note.text()).toContain('We don\'t have details about individual doctors at this clinic yet.')
        expect(wrapper.find('[data-testid="search-details-add-professional"]').attributes('href')).toMatch(/\/submit$/)
    })

    it('shows no note once a doctor is listed', async () => {
        const card = await mountSuspended(SearchResultCard, { props: { result: result([doctor]), from: 'results' } })
        const details = await mountSuspended(SearchResultDetails, { props: { facility: result([doctor]) } })

        expect(card.find('[data-testid="search-result-no-professionals"]').exists()).toBe(false)
        expect(details.find('[data-testid="search-details-no-professionals"]').exists()).toBe(false)
        expect(details.findAll('[data-testid="search-details-professional"]')).toHaveLength(1)
    })
})
