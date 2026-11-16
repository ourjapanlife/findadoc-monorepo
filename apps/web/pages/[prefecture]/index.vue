<template>
    <div
        data-testid="hub-prefecture-page"
        class="page-container flex flex-col gap-6 px-4 py-8"
    >
        <BreadcrumbNav :items="crumbs" />

        <header class="flex flex-col gap-2">
            <h1 class="text-2xl/tight font-bold text-primary-text">
                {{ heading }}
            </h1>
            <p class="m-0 text-sm text-primary-text-muted">
                {{ facilityCountText }}
            </p>
        </header>

        <section
            v-if="prefecture.cities.length"
            class="flex flex-col gap-3"
        >
            <h2 class="text-lg font-semibold text-primary-text">
                {{ t('hubPage.citiesHeading') }}
            </h2>
            <ul
                class="m-0 flex list-none flex-wrap gap-2 p-0"
                data-testid="hub-city-list"
            >
                <li
                    v-for="city in prefecture.cities"
                    :key="city.path"
                >
                    <NuxtLink
                        :to="city.path"
                        class="chip h-8 px-3 text-sm"
                    >
                        {{ cityLabel(city) }}
                    </NuxtLink>
                </li>
            </ul>
        </section>

        <section
            v-if="facets.specialties.length"
            class="flex flex-col gap-3"
        >
            <h2 class="text-lg font-semibold text-primary-text">
                {{ t('hubPage.specialtiesHeading') }}
            </h2>
            <ul
                class="m-0 flex list-none flex-wrap gap-2 p-0"
                data-testid="hub-specialty-list"
            >
                <li
                    v-for="entry in facets.specialties"
                    :key="entry.path"
                >
                    <NuxtLink
                        :to="entry.path"
                        class="chip h-8 px-3 text-sm"
                    >
                        {{ facetLabel(entry) }}
                    </NuxtLink>
                </li>
            </ul>
        </section>

        <section
            v-if="facets.languages.length"
            class="flex flex-col gap-3"
        >
            <h2 class="text-lg font-semibold text-primary-text">
                {{ t('hubPage.languagesHeading') }}
            </h2>
            <ul
                class="m-0 flex list-none flex-wrap gap-2 p-0"
                data-testid="hub-language-list"
            >
                <li
                    v-for="entry in facets.languages"
                    :key="entry.path"
                >
                    <NuxtLink
                        :to="entry.path"
                        class="chip h-8 px-3 text-sm"
                    >
                        {{ t('hubPage.languageChip', { language: facetLabel(entry) }) }}
                    </NuxtLink>
                </li>
            </ul>
        </section>

        <section class="flex flex-col gap-3">
            <h2 class="text-lg font-semibold text-primary-text">
                {{ t('hubPage.facilitiesHeading') }}
            </h2>
            <HubFacilityList :facilities="prefecture.facilities" />
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import generatedPrefectureHubs from '#generated-prefecture-hubs'
import { createError, navigateTo, useAsyncData, useHead, useRoute } from '#imports'
import { canonicalPathMatches, facilityDocumentTitle, slugifySegment } from '~/utils/clinicPath'
import { localeCodeFromPath, localizedPath } from '~/utils/localePath'
import { loadPrefectureFacets, loadPrefectureHub } from '~/utils/hubDirectory'
import { prefectureHubCrumbs } from '~/utils/directoryLinks'
import { breadcrumbListJsonLd, jsonLdScript } from '~/utils/structuredData'
import { isReservedHubSegment } from '~/utils/hubPath'
import { hubFacetLabel, hubPlaceName } from '~/utils/hubLabels'
import { formatPageTitle } from '~/utils/site'
import type { HubCity } from '~/utils/hubIndex'
import type { FacetLinkEntry } from '~/utils/directoryLinks'

const route = useRoute()
const { t, locale } = useI18n()

const prefectureSlug = slugifySegment(String(route.params.prefecture ?? ''))

if (!prefectureSlug || isReservedHubSegment(prefectureSlug)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

// Client only: the static 404 hydrates onto this route for unknown URLs.
// Prerender must not throw here, or a list mismatch fails the generate.
if (
    import.meta.client
      && Array.isArray(generatedPrefectureHubs)
      && !generatedPrefectureHubs.includes(`/${prefectureSlug}`)
) {
    throw createError({ fatal: true, statusCode: 404, statusMessage: 'Page not found' })
}

const { data } = await useAsyncData(`hub-prefecture:${prefectureSlug}`, () => loadPrefectureHub(prefectureSlug))
const { data: facetData } = await useAsyncData(
    `hub-facets:${prefectureSlug}`,
    () => loadPrefectureFacets(prefectureSlug)
)

if (!data.value) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const prefecture = computed(() => data.value!)
const facets = computed(() => facetData.value ?? { specialties: [], languages: [] })
const displayPrefecture = computed(() => hubPlaceName(
    prefecture.value.prefectureEn,
    prefecture.value.prefectureJa,
    locale.value
))

const heading = computed(() => t('hubPage.prefectureHeading', { prefecture: displayPrefecture.value }))
const crumbs = computed(() => prefectureHubCrumbs({
    homeLabel: t('breadcrumbs.home'),
    prefectureLabel: displayPrefecture.value
}))
const facilityCountText = computed(() => t('hubPage.facilityCount', prefecture.value.facilities.length))
// The heading is translated, so the title is too (English stays "Healthcare in Tokyo").
const documentTitle = computed(() => facilityDocumentTitle(heading.value))
const brandedTitle = computed(() => formatPageTitle(documentTitle.value))
const metaDescription = computed(() => t('hubPage.prefectureMeta', { prefecture: displayPrefecture.value }))

/** A facet in the reader's language ("英語", "牙医"). English keeps the indexed label. */
function facetLabel(entry: FacetLinkEntry): string {
    return hubFacetLabel(entry, locale.value, t)
}

function cityLabel(city: HubCity): string {
    return hubPlaceName(city.cityEn, city.cityJa, locale.value)
}

if (!canonicalPathMatches(route.path, data.value.path)) {
    await navigateTo(localizedPath(data.value.path, localeCodeFromPath(route.path)), {
        redirectCode: 301,
        replace: true
    })
} else {
    useHead({
        title: documentTitle,
        meta: computed(() => [
            { name: 'description', content: metaDescription.value, key: 'description' },
            { property: 'og:title', content: brandedTitle.value, key: 'og:title' },
            { property: 'og:description', content: metaDescription.value, key: 'og:description' },
            { name: 'twitter:title', content: brandedTitle.value, key: 'twitter:title' },
            { name: 'twitter:description', content: metaDescription.value, key: 'twitter:description' }
        ]),
        script: computed(() => [
            jsonLdScript('ld-breadcrumb', breadcrumbListJsonLd(crumbs.value, prefecture.value.path, locale.value))
        ])
    })
}
</script>
