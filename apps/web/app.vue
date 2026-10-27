<template>
    <NuxtLayout
        v-if="hostedClinicSlug"
        name="clinic-landing"
    >
        <ClinicHostLanding />
    </NuxtLayout>
    <NuxtLayout v-else>
        <NuxtPage />
    </NuxtLayout>
    <!--
        Renders on the server as an empty viewport. The manager drops any toast
        fired during SSR, so this stays out of ClientOnly.
    -->
    <AppToast />
    <!--
        Client-only: the dialog reads $confirmationDialog, which is provided by a
        .client plugin and is therefore undefined during SSR. It has nothing to
        render server-side anyway — it only ever appears in response to a user
        action.
    -->
    <ClientOnly>
        <ConfirmationDialog />
    </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { initializeGqlClient } from './utils/graphql.js'
import ClinicHostLanding from '~/pages/clinic/[slug].vue'
import {
    clinicLandingHostSlug,
    clinicLandingMode,
    clinicLandingPath,
    clinicSubdomainHreflang,
    clinicSubdomainUrl,
    isClinicHostPage,
    isClinicLandingPath
} from '~/utils/clinicLanding'
import { isEntityRoute, pageDescriptionKeyForPath, pageMetaI18nKey, pageTitleKeyForPath } from '~/utils/pageTitles'
import { canonicalUrl, hreflangLinkTags, indexableLocaleCodes, isNoindexRoute, openGraphLocale } from '~/utils/seo'
import { jsonLdScript, organizationJsonLd } from '~/utils/structuredData'
import { formatPageTitle } from '~/utils/site'
import { useHead, useRequestURL, useRoute, useRuntimeConfig } from '#imports'

initializeGqlClient()

const route = useRoute()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const { t, locale } = useI18n()

const hostedClinicSlug = computed(() => {
    const host = import.meta.server ? requestUrl.hostname : window.location.hostname
    if (clinicLandingMode(config.public.onlineClinic) === 'off') {
        return undefined
    }
    if (!isClinicHostPage(route.path)) {
        return undefined
    }
    return clinicLandingHostSlug(host)
})

const canonical = computed(() => {
    const slug = hostedClinicSlug.value
    if (slug) {
        const prefix = String(locale.value) === 'en-US' ? '' : `/${locale.value}`
        const host = import.meta.server ? requestUrl.host : window.location.host
        return clinicSubdomainUrl(slug, prefix, host)
    }
    return canonicalUrl(route.path)
})

// Titles live in PAGE_META_TITLE_ROUTES, not in each page, so a missing public
// route is a type/test failure instead of a forgotten useHead. Canonical, og:url,
// and noindex follow the same path so they cannot drift from the document title.
// Entity routes (`/clinic/…`, `/doctor/…`, `/tokyo`, `/tokyo/dentistry`) set their own title from the
// record — omitting `title` here lets that win instead of the brand-only fallback.
// The template function must be set at runtime: nuxt.config head is serialized
// into the app manifest, and functions declared there are silently dropped.
useHead(() => {
    // Unhead's meta and link inputs are discriminated unions. A shared
    // `{ name?: string, property?: string }` element is not assignable to any
    // member, so each tag keeps its own literal shape.
    const noindex = hostedClinicSlug.value
        ? isNoindexRoute(clinicLandingPath(hostedClinicSlug.value), route.query, config.public.onlineClinic)
        : isNoindexRoute(route.path, route.query, config.public.onlineClinic)
    const meta: Array<
      | { property: 'og:url' | 'og:locale' | 'og:locale:alternate' | 'og:description', content: string, key: string }
      | { name: 'robots' | 'description' | 'twitter:description', content: string, key: string }
    > = [
        { property: 'og:url', content: canonical.value, key: 'og:url' },
        { property: 'og:locale', content: openGraphLocale(String(locale.value)), key: 'og:locale' }
    ]

    for (const code of indexableLocaleCodes(route.path)) {
        if (code === locale.value) {
            continue
        }
        meta.push({
            property: 'og:locale:alternate',
            content: openGraphLocale(code),
            key: `og:locale:${code}`
        })
    }

    if (noindex) {
        meta.push({ name: 'robots', content: 'noindex', key: 'robots' })
    }

    // Entity routes set their own title from the record. Omitting `title` lets that
    // win. A public route with no catalog key still sends '' so the brand fallback applies.
    let title: string | undefined
    // Landings set their own title and share image. An empty catalog title here
    // would replace both with the brand-only fallback.
    if (!hostedClinicSlug.value && !isEntityRoute(route.path) && !isClinicLandingPath(route.path)) {
        const key = pageTitleKeyForPath(route.path)
        title = key ? t(pageMetaI18nKey(key)) : ''
        const descriptionKey = pageDescriptionKeyForPath(route.path)
        if (descriptionKey) {
            const description = t(descriptionKey)
            meta.push(
                { name: 'description', content: description, key: 'description' },
                { property: 'og:description', content: description, key: 'og:description' },
                { name: 'twitter:description', content: description, key: 'twitter:description' }
            )
        }
    }

    return {
        htmlAttrs: { lang: String(locale.value) },
        ...(title !== undefined ? { title } : {}),
        titleTemplate: (title?: string) => formatPageTitle(title),
        link: [
            { rel: 'canonical' as const, href: canonical.value, key: 'canonical' },
            // noindex directory URLs are not in the hreflang cluster. A one-way
            // alternate from /zh-CN/clinic/… to /clinic/… would point at a page
            // that does not link back.
            ...(noindex
                ? []
                : hostedClinicSlug.value
                    ? clinicSubdomainHreflang(
                        hostedClinicSlug.value,
                        import.meta.server ? requestUrl.host : window.location.host
                    )
                    : hreflangLinkTags(route.path))
        ],
        meta,
        script: [jsonLdScript('ld-organization', organizationJsonLd())]
    }
})
</script>
