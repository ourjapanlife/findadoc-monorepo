import { onMounted, ref, watch, type Ref } from 'vue'
import type { Specialty } from '@findadoc/graphql'
import directoryStats from '#directory-stats'
import { fetchCities, type CityOption } from '~/utils/cityOptions'
import { fetchDirectoryCoverage } from '~/utils/directoryCoverage'
import { directoryPrefectures, type PrefectureEntry } from '~/utils/homeDirectory'

/**
 * The prefectures, cities, and specialties a picker offers, from what the directory has (#21).
 *
 * The first render, prerendered HTML included, uses the counts this build computed
 * (`#directory-stats`). Once mounted, the live coverage from the API replaces them, so a place
 * added after the build shows up without another deploy. When the API cannot answer, the build's
 * list stays, a chosen prefecture offers every city, and every specialty stays. Nothing is
 * fetched during prerender.
 */
export function useDirectoryCoverage(prefecture: Ref<string>) {
    const prefectures = ref<readonly PrefectureEntry[]>(directoryPrefectures(directoryStats))
    const cities = ref<CityOption[]>([])
    const specialties = ref<Specialty[]>()
    let request = 0

    async function load(value: string) {
        const current = ++request
        cities.value = []
        // Another prefecture's specialties would hide this one's while it loads. Every
        // specialty shows until the answer arrives.
        specialties.value = undefined

        const coverage = await fetchDirectoryCoverage(value || undefined)
        if (current !== request) return

        if (coverage?.prefectures.length) {
            prefectures.value = coverage.prefectures
        }
        specialties.value = coverage?.specialties
        if (!value) return
        if (coverage) {
            cities.value = coverage.cities
            return
        }

        try {
            const allCities = await fetchCities(value)
            if (current !== request) return
            cities.value = allCities
        } catch (error) {
            if (current !== request) return
            console.error('Loading cities failed', error)
        }
    }

    onMounted(() => {
        watch(prefecture, value => {
            void load(value)
        }, { immediate: true })
    })

    return { prefectures, cities, specialties }
}
