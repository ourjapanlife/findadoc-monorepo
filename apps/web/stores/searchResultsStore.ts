import { defineStore } from 'pinia'
import { computed, ref, watch, type Ref } from 'vue'
import type { SearchFilters } from '~/utils/searchDirectory'
import type { Locale, Specialty } from '@findadoc/graphql'

/** Results shown per "load more" step. */
export const SEARCH_RESULTS_PER_PAGE = 25

/**
 * The search screen's UI state: filters, how many results are shown, and the open facility.
 * The directory itself is server data and lives in vue-query (`useSearchDirectory`, #242).
 */
export const useSearchResultsStore = defineStore('searchResultsStore', () => {
    const selectedCity: Ref<string | undefined> = ref()
    const selectedPrefecture: Ref<string | undefined> = ref()
    const selectedSpecialties: Ref<Specialty[] | undefined> = ref()
    const selectedLanguages: Ref<Locale[] | undefined> = ref()

    const filters = computed<SearchFilters>(() => ({
        city: selectedCity.value,
        prefecture: selectedPrefecture.value,
        specialties: selectedSpecialties.value,
        languages: selectedLanguages.value
    }))

    const currentPage = ref(1)

    // A new filter combination starts from the first page.
    watch(filters, () => {
        currentPage.value = 1
    })

    const activeFacilityId: Ref<string | undefined> = ref()

    function setActiveFacility(facilityId: string) {
        activeFacilityId.value = facilityId
    }

    function clearActiveSearchResult() {
        activeFacilityId.value = undefined
    }

    function clearFilters() {
        selectedCity.value = undefined
        selectedPrefecture.value = undefined
        selectedSpecialties.value = undefined
        selectedLanguages.value = undefined
    }

    return {
        selectedCity,
        selectedPrefecture,
        selectedSpecialties,
        selectedLanguages,
        filters,
        clearFilters,
        currentPage,
        activeFacilityId,
        setActiveFacility,
        clearActiveSearchResult
    }
})
