<template>
    <div
        data-testid="search-filter-bar"
        class="sticky top-16 z-20 w-full border-b border-accent-bg bg-primary-bg/95 backdrop-blur-md"
    >
        <div class="page-container flex flex-col gap-3 px-4 py-3 landscape:px-6">
            <!-- Summary row: count and controls side by side; on narrow screens the count drops below. -->
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p
                    data-testid="search-result-count"
                    aria-live="polite"
                    class="m-0 min-w-0 text-sm font-medium text-primary-text-muted portrait:order-last portrait:basis-full"
                >
                    {{ countText }}
                </p>
                <!--
                    Three equal columns on a phone, so a long translation wraps inside its own button
                    instead of pushing the last one off screen.
                -->
                <div
                    class="flex shrink-0 items-center gap-2 portrait:grid portrait:w-full portrait:grid-cols-3
                           portrait:items-stretch"
                >
                    <button
                        type="button"
                        data-testid="search-filters-toggle"
                        :aria-expanded="filtersOpen ?? false"
                        aria-controls="search-filters"
                        class="btn btn-secondary btn-sm portrait:h-auto portrait:min-h-10 portrait:gap-1.5 portrait:px-2
                               portrait:py-1.5 portrait:text-sm/tight portrait:whitespace-normal"
                        @click="toggleFilters"
                    >
                        <SVGFiltersIcon
                            class="size-4 fill-current"
                            aria-hidden="true"
                        />
                        {{ t('search.filters') }}
                        <span
                            v-if="activeFilterCount"
                            class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5
                                   text-xs font-bold text-primary-text-inverted"
                        >{{ activeFilterCount }}</span>
                        <SVGAccordionArrow
                            class="size-3 shrink-0 fill-current transition-transform portrait:hidden"
                            :class="filtersOpen ? 'rotate-180' : ''"
                            aria-hidden="true"
                        />
                    </button>
                    <!--
                        Near me sorts the results; it filters nothing. The browser is asked for a
                        position only from this tap, never on page load.
                    -->
                    <button
                        v-if="nearMe.isSupported"
                        type="button"
                        data-testid="search-near-me"
                        :aria-pressed="isSortedByDistance"
                        :aria-busy="isLocating"
                        aria-describedby="search-near-me-status"
                        class="btn btn-secondary btn-sm portrait:h-auto portrait:min-h-10 portrait:gap-1.5 portrait:px-2
                               portrait:py-1.5 portrait:text-sm/tight portrait:whitespace-normal"
                        @click="toggleNearMe"
                    >
                        <svg
                            class="size-4 shrink-0 stroke-current"
                            :class="isLocating ? 'animate-pulse' : ''"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="7"
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r="2.5"
                                :class="isSortedByDistance ? 'fill-current' : ''"
                            />
                            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                        {{ t('search.nearMe') }}
                    </button>
                    <button
                        type="button"
                        data-testid="search-map-toggle"
                        :aria-pressed="showMap"
                        class="btn btn-secondary btn-sm portrait:h-auto portrait:min-h-10 portrait:gap-1.5 portrait:px-2
                               portrait:py-1.5 portrait:text-sm/tight portrait:whitespace-normal"
                        @click="toggleMap"
                    >
                        <SVGMapPinIcon
                            class="size-4 stroke-current"
                            aria-hidden="true"
                        />
                        {{ showMap ? t('search.hideMap') : t('search.showMap') }}
                    </button>
                </div>
            </div>

            <!--
                What Near me is doing, and the privacy line. Polite live region: it reports
                "finding", "sorted", or why it could not, without moving focus.
            -->
            <div
                id="search-near-me-status"
                data-testid="search-near-me-status"
                aria-live="polite"
                class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                :class="nearMeMessage ? '' : 'sr-only'"
            >
                <p
                    v-if="nearMeMessage"
                    class="m-0"
                    :class="nearMeFailed ? 'text-primary-text' : 'text-primary-text-muted'"
                >
                    {{ nearMeMessage }}
                </p>
                <button
                    v-if="nearMeFailed"
                    type="button"
                    data-testid="search-near-me-choose-area"
                    class="font-medium text-primary underline-offset-2 hover:underline"
                    @click="chooseAreaInstead"
                >
                    {{ t('search.nearMeChooseArea') }}
                </button>
            </div>

            <!-- What the collapsed bar is filtering on, so the visitor does not have to open it to check. -->
            <p
                v-if="filterSummary"
                data-testid="search-filter-summary"
                class="m-0 truncate text-sm text-primary-text"
                :class="summaryClass"
            >
                {{ filterSummary }}
            </p>

            <!-- Filters: open by default in landscape, closed in portrait; the toggle collapses them in both. -->
            <form
                id="search-filters"
                data-testid="search-filters"
                :class="formClass"
                class="grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] landscape:grid-cols-2 landscape:items-end"
                @submit.prevent
            >
                <div class="min-w-0">
                    <label
                        for="search-specialty-group"
                        class="field-label"
                    >{{ t('home.searchSpecialtyLabel') }}</label>
                    <select
                        id="search-specialty-group"
                        v-model="specialtyGroup"
                        data-testid="search-specialty-group"
                        class="field"
                        @change="onFilterChange"
                    >
                        <option value="">
                            {{ t('searchBar.allSpecialties') }}
                        </option>
                        <option
                            v-for="option in specialtyGroupOptions"
                            :key="option.code"
                            :value="option.code"
                        >
                            {{ option.displayText }}
                        </option>
                    </select>
                </div>

                <div class="relative min-w-0">
                    <label
                        for="search-specialty"
                        class="field-label"
                    >{{ t('home.searchSubspecialtyLabel') }}</label>
                    <select
                        id="search-specialty"
                        v-model="specialty"
                        data-testid="search-specialty"
                        class="field"
                        :disabled="!specialtyGroup"
                        @change="onFilterChange"
                    >
                        <option value="">
                            {{ t('searchBar.allSubspecialties') }}
                        </option>
                        <option
                            v-for="option in specialtyOptions"
                            :key="option.code"
                            :value="option.code"
                        >
                            {{ option.displayText }}
                        </option>
                    </select>
                    <!-- As with the city list: a disabled select takes no clicks, so this records the attempt. -->
                    <button
                        v-if="!specialtyGroup"
                        type="button"
                        class="absolute inset-0 cursor-not-allowed"
                        :aria-label="t('home.searchSubspecialtyLabel')"
                        @click="onSpecialtyFieldClick"
                    />
                </div>

                <div class="min-w-0">
                    <label
                        for="search-language"
                        class="field-label"
                    >{{ t('home.searchLanguageLabel') }}</label>
                    <select
                        id="search-language"
                        v-model="language"
                        data-testid="search-language"
                        class="field"
                        @change="onFilterChange"
                    >
                        <option value="">
                            {{ t('home.searchAnyLanguage') }}
                        </option>
                        <option
                            v-for="option in languageOptions"
                            :key="option.code"
                            :value="option.code"
                        >
                            {{ languageName(option.code, locale) }}
                        </option>
                    </select>
                </div>

                <div class="min-w-0">
                    <label
                        for="search-region"
                        class="field-label"
                    >{{ t('home.searchAreaLabel') }}</label>
                    <select
                        id="search-region"
                        v-model="region"
                        data-testid="search-region"
                        class="field"
                        @change="onFilterChange"
                    >
                        <option value="">
                            {{ t('home.searchAnyArea') }}
                        </option>
                        <option
                            v-for="code in regionOptions"
                            :key="code"
                            :value="code"
                        >
                            {{ t(REGION_LABEL_KEYS[code]) }}
                        </option>
                    </select>
                </div>

                <div class="min-w-0">
                    <label
                        for="search-area"
                        class="field-label"
                    >{{ t('home.searchPrefectureLabel') }}</label>
                    <select
                        id="search-area"
                        v-model="prefecture"
                        data-testid="search-area"
                        class="field"
                        @change="onFilterChange"
                    >
                        <option value="">
                            {{ region ? t('home.searchAnyPrefectureInRegion') : t('home.searchAnyPrefecture') }}
                        </option>
                        <option
                            v-for="entry in prefectureOptions"
                            :key="entry.name"
                            :value="entry.name.toLowerCase()"
                        >
                            {{ prefectureOptionLabel(entry, locale === 'ja-JP') }}
                        </option>
                    </select>
                </div>

                <div class="relative min-w-0">
                    <label
                        for="search-city"
                        class="field-label"
                    >{{ t('home.searchCityLabel') }}</label>
                    <select
                        id="search-city"
                        v-model="city"
                        data-testid="search-city"
                        class="field"
                        :disabled="!prefecture"
                        @change="onFilterChange"
                    >
                        <option value="">
                            {{ t('home.searchAnyCity') }}
                        </option>
                        <option
                            v-for="option in cityOptions"
                            :key="option.id"
                            :value="option.slug"
                        >
                            {{ locale === 'ja-JP' ? option.nameJa : option.nameEn }}
                        </option>
                    </select>
                    <!--
                        A disabled select does not receive clicks, so the attempt has to be a
                        control of its own. It only exists until a prefecture is chosen.
                    -->
                    <button
                        v-if="!prefecture"
                        type="button"
                        class="absolute inset-0 cursor-not-allowed"
                        :aria-label="t('home.searchCityLabel')"
                        @click="onCityFieldClick"
                    />
                </div>

                <button
                    type="button"
                    data-testid="search-clear-filters"
                    class="btn btn-ghost h-12 px-4"
                    :class="hasFilters ? '' : 'invisible portrait:hidden'"
                    :tabindex="hasFilters ? undefined : -1"
                    @click="clearFromBar"
                >
                    {{ t('search.clearFilters') }}
                </button>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SVGAccordionArrow from '~/assets/icons/accordion-arrow.svg'
import SVGFiltersIcon from '~/assets/icons/equalizer-icon.svg'
import SVGMapPinIcon from '~/assets/icons/map-pin-icon.svg'
import { NEAR_ME_STATUS, useNearMeStore } from '~/stores/nearMeStore'
import { useSearchResultsStore } from '~/stores/searchResultsStore'
import { NEAR_ME_SORT } from '~/utils/nearMe'
import { useSearchDirectory } from '~/composables/useSearchDirectory'
import { useSpecialtiesStore } from '~/stores/specialtiesStore'
import { localeDisplayOptions } from '~/stores/localeStore'
import { languageName } from '~/utils/languageName'
import { useUmami } from '~/composables/useUmamiTracking'
import { searchFilterFlags } from '~/utils/analyticsEvents'
import { SEARCHABLE_LANGUAGES, prefectureOptionLabel } from '~/utils/homeDirectory'
import { hasActiveFilters } from '~/utils/searchDirectory'
import {
    REGION_LABEL_KEYS,
    isJapanRegion,
    prefecturesInRegion,
    regionOfPrefecture,
    regionsWithPrefectures
} from '~/utils/japanRegions'
import { availableSpecialtyOptions } from '~/utils/directoryCoverage'
import { groupOfSpecialty, groupOptions, specialtiesForGroup } from '~/utils/specialtyPicker'
import { CATEGORY_LABEL_KEYS } from '~/utils/specialtyLabelKeys'
import { useDirectoryCoverage } from '~/composables/useDirectoryCoverage'
import type { Locale, Specialty, SpecialtyCategory } from '@findadoc/graphql'

const props = defineProps<{ showMap: boolean }>()
const emit = defineEmits<{ (e: 'update:showMap', value: boolean): void }>()

const { t, locale } = useI18n()
const searchResultsStore = useSearchResultsStore()
const { isLoading, hasLoadError, totalResults, isSortedByDistance } = useSearchDirectory()
const nearMe = useNearMeStore()
const specialtiesStore = useSpecialtiesStore()
const { track } = useUmami()

/*
 * Null until mounted: the server cannot know the orientation, so CSS picks the first state
 * (open in landscape, closed in portrait). After mount the toggle owns it in both.
 */
const filtersOpen = ref<boolean | null>(null)

const formClass = computed(() => {
    if (filtersOpen.value === null) return 'hidden landscape:grid'
    return filtersOpen.value ? 'grid' : 'hidden'
})

const summaryClass = computed(() => {
    if (filtersOpen.value === null) return 'landscape:hidden'
    return filtersOpen.value ? 'hidden' : ''
})

onMounted(async () => {
    filtersOpen.value = window.matchMedia('(orientation: landscape)').matches

    /*
     * A `?sort=near` link sorts on arrival only when the browser already allows location here,
     * so asking shows no prompt. Anyone else gets the button, and the prompt comes from a tap.
     */
    await nearMe.checkPermission()
    if (searchResultsStore.sort === NEAR_ME_SORT && nearMe.permissionGranted && !nearMe.position) {
        await nearMe.locate()
    }
})

/*
 * The same three controls as the homepage entry form, plus a city list from the city table,
 * bound straight to the store. Results are derived from the filters, so a change applies as
 * soon as it is made — no Search button.
 */
const specialty = computed({
    get: () => searchResultsStore.selectedSpecialties?.[0] ?? '',
    set: value => {
        searchResultsStore.selectedSpecialties = value ? [value as Specialty] : undefined
    }
})

/*
 * The group comes first, like a prefecture before a city (#277). A link with only `?specialty=`
 * shows that specialty's group. Changing the group clears the specialty.
 */
const specialtyGroup = computed({
    get: () => searchResultsStore.selectedSpecialtyGroup ?? groupOfSpecialty(specialty.value as Specialty | '') ?? '',
    set: value => {
        searchResultsStore.selectedSpecialtyGroup = (value || undefined) as SpecialtyCategory | undefined
        searchResultsStore.selectedSpecialties = undefined
    }
})

const language = computed({
    get: () => searchResultsStore.selectedLanguages?.[0] ?? '',
    set: value => {
        searchResultsStore.selectedLanguages = value ? [value as Locale] : undefined
    }
})

/*
 * Region, then prefecture, then city. A link with only `?prefecture=` shows that prefecture's
 * region. Changing the region clears the prefecture and city below it; picking a prefecture
 * records its region, so clearing the prefecture again falls back to the whole region.
 */
const region = computed({
    get: () => searchResultsStore.selectedRegion ?? regionOfPrefecture(searchResultsStore.selectedPrefecture) ?? '',
    set: value => {
        searchResultsStore.selectedRegion = isJapanRegion(value) ? value : undefined
        searchResultsStore.selectedPrefecture = undefined
        searchResultsStore.selectedCity = undefined
    }
})

const prefecture = computed({
    get: () => searchResultsStore.selectedPrefecture?.toLowerCase() ?? '',
    set: value => {
        searchResultsStore.selectedPrefecture = value || undefined
        searchResultsStore.selectedCity = undefined
        const prefectureRegion = regionOfPrefecture(value)
        if (prefectureRegion !== undefined) {
            searchResultsStore.selectedRegion = prefectureRegion
        }
    }
})

const city = computed({
    get: () => searchResultsStore.selectedCity ?? '',
    set: value => {
        searchResultsStore.selectedCity = value || undefined
    }
})

const {
    prefectures,
    cities: cityOptions,
    specialties: availableSpecialties
} = useDirectoryCoverage(prefecture)

const regionOptions = computed(() => regionsWithPrefectures(prefectures.value, region.value || undefined))

const prefectureOptions = computed(() => prefecturesInRegion(prefectures.value, region.value || undefined))

const specialtyGroupOptions = computed(() => groupOptions(
    code => t(CATEGORY_LABEL_KEYS[code]),
    availableSpecialties.value,
    specialtyGroup.value || undefined
))

const specialtyOptions = computed(() => specialtiesForGroup(
    availableSpecialtyOptions(
        specialtiesStore.specialtyDisplayOptions,
        availableSpecialties.value,
        specialty.value as Specialty | ''
    ),
    specialtyGroup.value || undefined
))

const languageOptions = computed(() =>
    SEARCHABLE_LANGUAGES
        .map(code => localeDisplayOptions.find(option => option.code === code))
        .filter((option): option is NonNullable<typeof option> => !!option))

const hasFilters = computed(() => hasActiveFilters(searchResultsStore.filters))

function toggleFilters() {
    filtersOpen.value = !filtersOpen.value
    if (filtersOpen.value) track('Filters opened')
}

function toggleMap() {
    const next = !props.showMap
    emit('update:showMap', next)
    track('Map toggled', { state: next ? 'shown' : 'hidden' })
}

const isLocating = computed(() => nearMe.status === NEAR_ME_STATUS.LOCATING)
const nearMeFailed = computed(() => nearMe.status === NEAR_ME_STATUS.DENIED
  || nearMe.status === NEAR_ME_STATUS.UNAVAILABLE)

const nearMeMessage = computed(() => {
    switch (nearMe.status) {
        case NEAR_ME_STATUS.LOCATING: return t('search.nearMeLocating')
        case NEAR_ME_STATUS.DENIED: return t('search.nearMeDenied')
        case NEAR_ME_STATUS.UNAVAILABLE: return t('search.nearMeUnavailable')
        default: return isSortedByDistance.value ? t('search.nearMeSorted') : ''
    }
})

/**
 * On: ask for a position (or reuse the one from earlier in this visit) and sort by it.
 * Off: back to directory order. The position stays in memory, so turning it on again is instant.
 */
async function toggleNearMe() {
    // Not disabled while waiting, so focus stays on the button; a second tap just waits too.
    if (isLocating.value) return
    if (isSortedByDistance.value) {
        searchResultsStore.sort = undefined
        track('Near me', { result: 'off' })
        return
    }

    const position = nearMe.position ?? await nearMe.locate()
    if (position) {
        searchResultsStore.sort = NEAR_ME_SORT
        track('Near me', { result: 'located' })
        return
    }
    track('Near me', { result: nearMe.status === NEAR_ME_STATUS.DENIED ? 'denied' : 'unavailable' })
}

/** Without a location, the area filter is the way to find what is close. */
async function chooseAreaInstead() {
    filtersOpen.value = true
    await nextTick()
    document.getElementById('search-region')?.focus()
}

function onFilterChange() {
    track('Filters changed', searchFilterFlags(searchResultsStore.filters))
}

function onSpecialtyFieldClick() {
    if (specialtyGroup.value) return
    track('Filter unavailable', { control: 'specialty' })
}

function onCityFieldClick() {
    if (prefecture.value) return
    track('Filter unavailable', { control: 'city' })
}

function clearFromBar() {
    searchResultsStore.clearFilters()
    track('Filters cleared', { from: 'filter_bar' })
}

const activeFilterCount = computed(() =>
    [specialtyGroup.value, specialty.value, language.value, region.value, prefecture.value, searchResultsStore.selectedCity]
        .filter(Boolean).length)

/** The chosen filters' labels in the order of the controls, for the collapsed bar. */
const filterSummary = computed(() => {
    const isJapanese = locale.value === 'ja-JP'
    const prefectureEntry = prefectures.value.find(entry => entry.name.toLowerCase() === prefecture.value)
    const cityEntry = cityOptions.value.find(option => option.slug === city.value)
    // A specialty names its group already, so the group is shown only on its own.
    const specialtyOption = specialtyOptions.value.find(option => option.code === specialty.value)
    const groupOption = specialtyGroupOptions.value.find(option => option.code === specialtyGroup.value)
    const specialtyLabel = specialtyOption?.displayText ?? groupOption?.displayText
    // Likewise a prefecture names its region, so the region is shown only on its own.
    const prefectureLabel = isJapanese ? prefectureEntry?.nameJa : prefectureEntry?.name
    const regionLabel = isJapanRegion(region.value) ? t(REGION_LABEL_KEYS[region.value]) : undefined
    const labels = [
        specialtyLabel,
        language.value ? languageName(language.value, locale.value) : undefined,
        prefectureLabel ?? regionLabel,
        cityEntry ? (isJapanese ? cityEntry.nameJa : cityEntry.nameEn) : undefined
    ]
    return labels.filter((label): label is string => !!label).join(' · ')
})

const countText = computed(() => {
    if (isLoading.value) return t('search.loading')
    if (hasLoadError.value) return ''
    return t('searchBar.resultsFound', totalResults.value)
})
</script>
