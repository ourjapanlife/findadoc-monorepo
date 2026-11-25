<template>
    <!--
        action/method are not decoration. The homepage is prerendered, so this form is
        in the HTML and clickable before Vue hydrates — and it is the primary control on
        the page. Without them an early submit fired a native GET to "/" and lost the
        user's selection. With them the same submit lands on /search with the filters
        applied, which is also what happens with JavaScript disabled.
    -->
    <form
        action="/search"
        method="get"
        data-testid="home-search-entry"
        class="card flex w-full max-w-xl flex-col gap-3 p-5"
        @submit.prevent="submitSearch"
    >
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <label
                for="home-specialty"
                class="field-label mb-0"
            >{{ t('home.searchSpecialtyLabel') }}</label>
            <select
                id="home-specialty"
                name="specialty"
                data-testid="home-specialty"
                class="field"
            >
                <option value="">
                    {{ t('searchBar.allSpecialties') }}
                </option>
                <!-- Grouped like the search page's two-step picker (#277), with no script before hydration. -->
                <optgroup
                    v-for="group in specialtyGroups"
                    :key="group.code"
                    :label="group.displayText"
                >
                    <option
                        v-for="option in group.options"
                        :key="option.code"
                        :value="specialtyQueryParam(option.code)"
                    >
                        {{ option.displayText }}
                    </option>
                </optgroup>
            </select>
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <label
                for="home-language"
                class="field-label mb-0"
            >{{ t('home.searchLanguageLabel') }}</label>
            <select
                id="home-language"
                name="language"
                data-testid="home-language"
                class="field"
            >
                <option value="">
                    {{ t('home.searchAnyLanguage') }}
                </option>
                <option
                    v-for="option in languageOptions"
                    :key="option.code"
                    :value="languageQueryParam(option.code)"
                >
                    {{ languageName(option.code, locale) }}
                </option>
            </select>
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <label
                for="home-area"
                class="field-label mb-0"
            >{{ t('home.searchAreaLabel') }}</label>
            <select
                id="home-area"
                name="prefecture"
                data-testid="home-area"
                class="field"
            >
                <option value="">
                    {{ t('home.searchAnyArea') }}
                </option>
                <!--
                    Prefectures under their region, north to south. A region of several prefectures
                    starts with a whole-region option, so a search can cover just that area.
                -->
                <optgroup
                    v-for="group in prefectureGroups"
                    :key="group.region"
                    :label="t(REGION_LABEL_KEYS[group.region])"
                >
                    <option
                        v-if="group.wholeRegion"
                        :value="group.wholeRegion.value"
                        :data-testid="`home-area-region-${group.wholeRegion.value}`"
                    >
                        {{ group.wholeRegion.label }}
                    </option>
                    <option
                        v-for="prefecture in group.prefectures"
                        :key="prefecture.name"
                        :value="prefectureQueryParam(prefecture.name)"
                    >
                        {{ prefectureOptionLabel(prefecture, locale === 'ja-JP') }}
                    </option>
                </optgroup>
            </select>
        </div>

        <button
            type="submit"
            data-testid="home-search-submit"
            class="btn btn-primary mt-1 w-full"
        >
            {{ t('home.searchSubmit') }}
        </button>
    </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PrefectureEntry } from '~/utils/homeDirectory'
import { useI18n } from 'vue-i18n'
import { navigateTo } from '#imports'
import { useUmami } from '~/composables/useUmamiTracking'
import { useRememberedSearch } from '~/composables/useRememberedSearch'
import { parseSearchQuery } from '~/utils/searchDirectory'
import { searchSubmittedProps } from '~/utils/analyticsEvents'
import { useSpecialtiesStore } from '~/stores/specialtiesStore'
import { localeDisplayOptions } from '~/stores/localeStore'
import { languageName } from '~/utils/languageName'
import { SEARCHABLE_LANGUAGES, prefectureOptionLabel, totalFacilities } from '~/utils/homeDirectory'
import { availableSpecialtyOptions } from '~/utils/directoryCoverage'
import { groupOptions, specialtiesForGroup } from '~/utils/specialtyPicker'
import { CATEGORY_LABEL_KEYS } from '~/utils/specialtyLabelKeys'
import { useDirectoryCoverage } from '~/composables/useDirectoryCoverage'
import {
    REGION_LABEL_KEYS,
    REGION_PREFECTURES,
    prefecturesInRegion,
    regionFromAreaValue,
    regionSearchParam,
    regionsWithPrefectures,
    type JapanRegion
} from '~/utils/japanRegions'

// The template compares vue-i18n's locale, not localeStore: the store only updates when someone
// uses the language picker, so a direct Japanese load would still read en-US. i18n says "ja-JP".
const { t, locale } = useI18n()
const specialtiesStore = useSpecialtiesStore()
const { track } = useUmami()
const { rememberOver } = useRememberedSearch()

// The homepage has no prefecture of its own, so only the country-wide lists load.
const { prefectures, specialties: availableSpecialties } = useDirectoryCoverage(ref(''))

/** "All of Kanto (120)". Hokkaido is one prefecture, so its prefecture option already covers it. */
function wholeRegionOption(region: JapanRegion, entries: readonly PrefectureEntry[]) {
    if (REGION_PREFECTURES[region].length < 2) {
        return undefined
    }
    const name = t('home.searchWholeRegion', { region: t(REGION_LABEL_KEYS[region]) })
    const total = totalFacilities(entries)
    return {
        value: regionSearchParam(region),
        label: total === undefined ? name : `${name} (${total})`
    }
}

const prefectureGroups = computed(() => regionsWithPrefectures(prefectures.value, undefined)
    .map(region => {
        const entries = prefecturesInRegion(prefectures.value, region)
        return { region, prefectures: entries, wholeRegion: wholeRegionOption(region, entries) }
    }))

/** Same encoding as the search URL: `dentistry`, `en`, `tokyo`. */
function specialtyQueryParam(code: string): string {
    return code.replaceAll('_', '-').toLowerCase()
}

function prefectureQueryParam(name: string): string {
    return name.toLowerCase()
}

function languageQueryParam(code: string): string {
    const [language, region] = code.split('_')
    const languageTag = (language ?? code).toLowerCase()
    if (languageTag === 'zh' && region) {
        return `zh-${region.toLowerCase()}`
    }
    return languageTag
}

/*
 * The first render uses the counts this build computed, so the form paints with no API call.
 * After mount, the live coverage narrows specialties to those with a professional, most
 * available first, and refreshes the prefectures. The location list is prefectures rather
 * than cities on purpose: a city picker needs a prefecture first.
 */
const specialtyOptions = computed(() => availableSpecialtyOptions(
    specialtiesStore.specialtyDisplayOptions,
    availableSpecialties.value,
    ''
))

const specialtyGroups = computed(() => groupOptions(code => t(CATEGORY_LABEL_KEYS[code]), availableSpecialties.value, undefined)
    .map(group => ({ ...group, options: specialtiesForGroup(specialtyOptions.value, group.code) }))
    .filter(group => group.options.length > 0))

const languageOptions = computed(() =>
    SEARCHABLE_LANGUAGES
        .map(code => localeDisplayOptions.find(option => option.code === code))
        .filter((option): option is NonNullable<typeof option> => !!option))

/*
 * Read the selections off the form rather than from refs.
 *
 * With v-model, a value chosen before hydration was wiped the moment Vue hydrated
 * and reset each <select> from its own (empty) reactive state — the user's choice
 * silently vanished and the search ran unfiltered. The form element is the single
 * source of truth for both the JS path and the no-JS path, so there is nothing left
 * to clobber.
 */
function submitSearch(event: Event) {
    const form = event.target as HTMLFormElement
    const query: Record<string, string> = {}

    for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === 'string' && value !== '') {
            query[key] = value
        }
    }

    // A whole-region option shares the list's name; send it as the search page's own region param.
    const region = regionFromAreaValue(query.prefecture)
    if (region !== undefined) {
        delete query.prefecture
        query.region = regionSearchParam(region)
    }

    track('Search submitted', searchSubmittedProps({
        specialty: Boolean(query.specialty),
        language: Boolean(query.language),
        region: Boolean(query.region),
        prefecture: Boolean(query.prefecture)
    }))
    // "Any language" here is the form's default, not a choice, so it keeps a remembered language.
    rememberOver(parseSearchQuery(query))
    void navigateTo({ path: '/search', query })
}
</script>
