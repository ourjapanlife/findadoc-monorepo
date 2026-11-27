import { defineStore } from 'pinia'
import { computed, ref, watch, type Ref } from 'vue'
import type { SearchFilters } from '~/utils/searchDirectory'
import type { JapanRegion } from '~/utils/japanRegions'
import type { SearchSort } from '~/utils/nearMe'
import type { Locale, Specialty, SpecialtyCategory } from '@findadoc/graphql'

/** Results shown per "load more" step. */
export const SEARCH_RESULTS_PER_PAGE = 25

/**
 * The search screen's UI state: filters, how many results are shown, and the open facility.
 * The directory itself is server data and lives in vue-query (`useSearchDirectory`, #242).
 */
export const useSearchResultsStore = defineStore('searchResultsStore', () => {
    const selectedCity: Ref<string | undefined> = ref()
    const selectedPrefecture: Ref<string | undefined> = ref()
    const selectedRegion: Ref<JapanRegion | undefined> = ref()
    const selectedSpecialtyGroup: Ref<SpecialtyCategory | undefined> = ref()
    const selectedSpecialties: Ref<Specialty[] | undefined> = ref()
    const selectedLanguages: Ref<Locale[] | undefined> = ref()

    const filters = computed<SearchFilters>(() => ({
        city: selectedCity.value,
        prefecture: selectedPrefecture.value,
        region: selectedRegion.value,
        specialtyGroup: selectedSpecialtyGroup.value,
        specialties: selectedSpecialties.value,
        languages: selectedLanguages.value
    }))

    /*
     * How results are ordered, apart from the filters: it narrows nothing, so "Clear filters"
     * leaves it alone. Undefined is directory order.
     */
    const sort: Ref<SearchSort | undefined> = ref()

    const currentPage = ref(1)

    /*
     * A new filter combination or order starts from the first page. Sync, so the reset lands
     * before search.vue restores `page` from a link; a queued reset would undo `?page=2`.
     */
    watch([filters, sort], () => {
        currentPage.value = 1
    }, { flush: 'sync' })

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
        selectedRegion.value = undefined
        selectedSpecialtyGroup.value = undefined
        selectedSpecialties.value = undefined
        selectedLanguages.value = undefined
    }

    return {
        selectedCity,
        selectedPrefecture,
        selectedRegion,
        selectedSpecialtyGroup,
        selectedSpecialties,
        selectedLanguages,
        filters,
        clearFilters,
        sort,
        currentPage,
        activeFacilityId,
        setActiveFacility,
        clearActiveSearchResult
    }
})
