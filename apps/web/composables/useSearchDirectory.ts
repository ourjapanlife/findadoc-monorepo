import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { SEARCH_RESULTS_PER_PAGE, useSearchResultsStore } from '~/stores/searchResultsStore'
import { DIRECTORY_GC_TIME_MS, DIRECTORY_STALE_TIME_MS } from '~/utils/queryClient'
import { queryKeys } from '~/utils/queryKeys'
import { filterDirectory, type FacilitySearchResult } from '~/utils/searchDirectory'
import { fetchSearchDirectory } from '~/utils/searchDirectoryQuery'
import { seedSearchDirectoryFromSnapshot } from '~/utils/searchDirectorySnapshot'

/**
 * The /search directory and the results built from it (#242).
 *
 * Every component that calls this shares one vue-query read, so the directory loads once and
 * a filter change runs no request. The store holds the filters; this holds the server data.
 *
 * The build's snapshot fills the results first when it arrives before the API does, and the
 * API answer replaces it.
 */
export function useSearchDirectory() {
    const store = useSearchResultsStore()
    const queryClient = useQueryClient()

    if (import.meta.client) {
        void seedSearchDirectoryFromSnapshot(queryClient)
    }

    const query = useQuery({
        queryKey: queryKeys.searchDirectory(),
        queryFn: ({ signal }) => fetchSearchDirectory(signal),
        staleTime: DIRECTORY_STALE_TIME_MS,
        gcTime: DIRECTORY_GC_TIME_MS,
        // Read in the browser only. A prerendered /search ships the skeleton, not a stale directory.
        enabled: import.meta.client
    })

    const facilities = computed(() => query.data.value?.facilities ?? [])
    const professionals = computed(() => query.data.value?.professionals ?? [])
    const hasDirectory = computed(() => query.data.value !== undefined)

    /*
     * A failed background refresh keeps the results on screen. Only a directory that never
     * loaded shows the error. A retry after an error shows the skeleton again while it runs.
     */
    const isLoading = computed(() => !hasDirectory.value && (query.isPending.value || query.isFetching.value))
    const hasLoadError = computed(() => !hasDirectory.value && query.isError.value && !query.isFetching.value)

    const searchResultsList = computed<FacilitySearchResult[]>(() =>
        filterDirectory(facilities.value, professionals.value, store.filters))

    const totalResults = computed(() => searchResultsList.value.length)

    const paginatedResults = computed(() =>
        searchResultsList.value.slice(0, store.currentPage * SEARCH_RESULTS_PER_PAGE))
    const hasMore = computed(() => paginatedResults.value.length < totalResults.value)

    function loadMore() {
        if (hasMore.value) {
            store.currentPage++
        }
    }

    /**
     * Resolved from the current results first, then from the whole directory: a shared link
     * to a facility should still open even when the link's filters exclude every professional
     * there. In that case the panel shows everyone at the facility.
     */
    const activeFacility = computed<FacilitySearchResult | undefined>(() => {
        const id = store.activeFacilityId
        if (!id) return undefined

        const fromResults = searchResultsList.value.find(facility => facility.id === id)
        if (fromResults) return fromResults

        const facility = facilities.value.find(candidate => candidate.id === id)
        if (!facility) return undefined

        const professionalIds = new Set(facility.healthcareProfessionalIds)
        return {
            ...facility,
            healthcareProfessionals: professionals.value.filter(professional => professionalIds.has(professional.id))
        }
    })

    /** Retry after a failed load. */
    async function reloadDirectory(): Promise<void> {
        await query.refetch()
    }

    return {
        isLoading,
        isReady: hasDirectory,
        hasLoadError,
        reloadDirectory,
        searchResultsList,
        paginatedResults,
        totalResults,
        hasMore,
        loadMore,
        activeFacility
    }
}
