<template>
    <section
        :aria-label="t('search.resultsRegion')"
        :aria-busy="isLoading"
        class="flex flex-col gap-4"
    >
        <!-- Failed load -->
        <div
            v-if="hasLoadError"
            data-testid="search-load-error"
            role="alert"
            class="card flex flex-col items-start gap-4 p-6"
        >
            <p class="m-0 text-primary-text">
                {{ t('search.loadError') }}
            </p>
            <button
                type="button"
                class="btn btn-primary btn-sm"
                @click="retrySearch"
            >
                {{ t('search.retry') }}
            </button>
        </div>

        <!-- Loading -->
        <ul
            v-else-if="isLoading"
            data-testid="search-skeleton"
            class="m-0 flex list-none flex-col gap-4 p-0"
            aria-hidden="true"
        >
            <li
                v-for="index in 4"
                :key="index"
                class="card flex flex-col gap-3 p-5"
            >
                <div class="skeleton h-5 w-2/3" />
                <div class="skeleton h-4 w-1/3" />
                <div class="flex gap-2">
                    <div class="skeleton h-7 w-20 rounded-full" />
                    <div class="skeleton h-7 w-16 rounded-full" />
                </div>
                <div class="skeleton h-4 w-1/2" />
            </li>
        </ul>

        <!-- Nothing matched -->
        <div
            v-else-if="!totalResults"
            data-testid="search-empty"
            class="card flex flex-col items-center gap-4 p-8 text-center"
        >
            <!-- Foreground shapes are currentColor; the backdrop blob follows the accent token. -->
            <SVGNoSearchResults
                class="h-20 w-auto text-primary"
                aria-hidden="true"
            />
            <div class="flex flex-col gap-1">
                <p class="m-0 text-lg font-semibold text-primary-text">
                    {{ t('searchResultsList.noResults') }}
                </p>
                <p class="m-0 text-primary-text-muted">
                    {{ t('searchResultsList.noResultsSubtext') }}
                </p>
            </div>
            <button
                v-if="hasFilters"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="clearFromEmpty"
            >
                {{ t('search.clearFilters') }}
            </button>
        </div>

        <!-- Results -->
        <template v-else>
            <ul
                data-testid="search-results-list"
                class="m-0 flex list-none flex-col gap-4 p-0"
            >
                <li
                    v-for="(result, index) in paginatedResults"
                    :key="result.id"
                    :data-testid="`search-result-list-item-${index}`"
                >
                    <SearchResultCard
                        :result="result"
                        from="results"
                        :active="searchResultsStore.activeFacilityId === result.id"
                    />
                </li>
            </ul>

            <div
                v-if="hasMore"
                class="flex flex-col items-center gap-2 py-2"
            >
                <button
                    type="button"
                    data-testid="load-more-button"
                    class="btn btn-secondary"
                    @click="handleLoadMore"
                >
                    {{ loadMoreLabel }}
                </button>
            </div>
        </template>
    </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SVGNoSearchResults from '~/assets/icons/no-search-results-graphic.svg'
import SearchResultCard from '~/components/search/SearchResultCard.vue'
import { useSearchResultsStore } from '~/stores/searchResultsStore'
import { useSearchDirectory } from '~/composables/useSearchDirectory'
import { useUmami } from '~/composables/useUmamiTracking'
import { resultsShownProps } from '~/utils/analyticsEvents'
import { hasActiveFilters } from '~/utils/searchDirectory'

const { t } = useI18n()
const searchResultsStore = useSearchResultsStore()
const {
    isLoading,
    isReady,
    hasLoadError,
    reloadDirectory,
    paginatedResults,
    totalResults,
    hasMore,
    loadMore
} = useSearchDirectory()
const { track } = useUmami()

const hasFilters = computed(() => hasActiveFilters(searchResultsStore.filters))

const remainingResults = computed(() =>
    totalResults.value - paginatedResults.value.length)

/*
 * One interpolated string, not three fragments glued together: "load more" + count +
 * "remaining" only reads correctly in English, and put the count in the wrong place in
 * Japanese and Russian.
 */
const loadMoreLabel = computed(() => t('searchResultsList.loadMoreCount', { n: remainingResults.value }))

function handleLoadMore() {
    loadMore()

    track('Load more results', {
        shown: paginatedResults.value.length,
        total: totalResults.value
    })
}

function retrySearch() {
    track('Search retried')
    void reloadDirectory()
}

function clearFromEmpty() {
    searchResultsStore.clearFilters()
    track('Filters cleared', { from: 'empty_results' })
}

/*
 * The signature includes the filter values so two searches with the same result
 * count still report separately. Those values are not part of the event.
 */
const resultsSignature = computed(() => {
    if (!isReady.value) return ''
    const filters = searchResultsStore.filters
    return [
        filters.specialties?.[0] ?? '',
        filters.languages?.[0] ?? '',
        filters.prefecture ?? '',
        filters.city ?? '',
        totalResults.value
    ].join('|')
})

watch(resultsSignature, () => {
    if (!isReady.value) return
    track('Results shown', resultsShownProps(
        totalResults.value ? 'some' : 'empty',
        hasFilters.value
    ))
}, { immediate: true })

watch(hasLoadError, failed => {
    if (failed) track('Search failed')
}, { immediate: true })
</script>
