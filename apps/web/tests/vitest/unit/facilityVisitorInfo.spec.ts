import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { Locale, OpeningDay, type Facility, type HealthcareProfessional } from '@findadoc/graphql'
import SearchResultDetails from '~/components/search/SearchResultDetails.vue'
import type { FacilitySearchResult } from '~/utils/searchDirectory'

function facility(fields: Partial<Facility> = {}): FacilitySearchResult {
    return {
        id: 'fake-clinic',
        slug: 'fake-clinic',
        nameEn: 'Fake Clinic',
        nameJa: 'フェイククリニック',
        supportedLanguages: [],
        paymentOptions: [],
        openingHours: [],
        additionalInfoEn: null,
        additionalInfoJa: null,
        healthcareProfessionalIds: [],
        contact: {
            address: { cityEn: 'Minato', cityJa: '港区', prefectureEn: 'Tokyo', prefectureJa: '東京都' }
        },
        healthcareProfessionals: [],
        ...fields
    } as unknown as Facility & { healthcareProfessionals: HealthcareProfessional[] }
}

describe('opening hours on the clinic details (#294)', () => {
    it('shows nothing when the hours are unknown', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: facility() } })

        expect(wrapper.find('[data-testid="facility-opening-hours"]').exists()).toBe(false)
    })

    it('lists each day, with a split day and closed days', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, {
            props: {
                facility: facility({
                    openingHours: [
                        { day: OpeningDay.Monday, opens: '09:00', closes: '12:30' },
                        { day: OpeningDay.Monday, opens: '15:00', closes: '18:00' }
                    ]
                })
            }
        })
        const hours = wrapper.find('[data-testid="facility-opening-hours"]').text()

        expect(hours).toContain('Monday')
        expect(hours).toContain('09:00–12:30, 15:00–18:00')
        expect(hours).toContain('Public holidays')
        expect(hours).toContain('Closed')
    })
})

describe('the visitor note on the clinic details (#294)', () => {
    it('shows the English note to an English reader, marked as English', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, {
            props: { facility: facility({ additionalInfoEn: 'Walk-ins welcome.', additionalInfoJa: '予約不要です。' }) }
        })
        const note = wrapper.find('[data-testid="facility-additional-info"] p')

        expect(note.text()).toBe('Walk-ins welcome.')
        expect(note.attributes('lang')).toBe('en')
    })

    it('shows nothing without a note', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: facility() } })

        expect(wrapper.find('[data-testid="facility-additional-info"]').exists()).toBe(false)
    })
})

describe('clinic-level languages', () => {
    it('says the clinic supports the language, not that every doctor speaks it', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, {
            props: { facility: facility({ supportedLanguages: [Locale.EnUs] }) }
        })

        expect(wrapper.find('[data-testid="facility-languages-caveat"]').text())
            .toContain('Not every doctor may speak them')
    })

    it('shows no caveat when the clinic lists no languages of its own', async () => {
        const wrapper = await mountSuspended(SearchResultDetails, { props: { facility: facility() } })

        expect(wrapper.find('[data-testid="facility-languages-caveat"]').exists()).toBe(false)
    })
})
