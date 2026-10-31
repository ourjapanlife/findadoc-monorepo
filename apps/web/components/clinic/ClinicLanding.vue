<template>
    <div
        id="top"
        data-testid="clinic-landing"
        class="relative bg-primary-bg"
        :class="{ 'clinic-theme': themeStyle !== undefined }"
        :style="themeStyle"
    >
        <ClinicLandingHeader
            :name="copy.name"
            :nav-label="copy.sectionNavLabel"
            :book-label="copy.book"
            :sections="sections"
            :locale-codes="siteLocaleCodes"
            @book="onBook"
        />
        <section class="relative overflow-hidden">
            <div
                class="pointer-events-none absolute inset-0
                    bg-[radial-gradient(ellipse_at_top_left,rgb(var(--theme-color-primary)/0.16),transparent_58%)]"
                aria-hidden="true"
            />
            <div class="page-section relative">
                <div
                    class="page-container flex flex-col gap-10 landscape:flex-row
                        landscape:items-center landscape:gap-14"
                >
                    <div class="flex flex-col gap-5 landscape:min-w-0 landscape:flex-[1.15]">
                        <p class="chip chip-primary h-auto w-fit gap-2 py-1.5">
                            {{ copy.heroBadge }}
                        </p>
                        <h1 class="page-title">
                            {{ copy.heroTitleBefore }}<span
                                class="bg-primary/15 box-decoration-clone px-1"
                            >{{ copy.heroTitleHighlight }}</span>
                        </h1>
                        <p class="text-lg text-primary-text-muted landscape:text-xl">
                            {{ copy.heroLead }}
                        </p>
                        <div class="flex flex-wrap gap-3">
                            <button
                                type="button"
                                class="btn btn-primary"
                                data-testid="clinic-landing-book"
                                @click="onBook"
                            >
                                {{ copy.book }}
                            </button>
                            <a
                                href="#fees"
                                class="btn btn-secondary"
                            >
                                {{ copy.seeFees }}
                            </a>
                        </div>
                        <p class="text-sm text-primary-text-muted">
                            {{ copy.heroNote }}
                        </p>
                    </div>
                    <figure class="relative m-0 landscape:flex-1">
                        <img
                            :src="content.hero"
                            :alt="copy.heroAlt"
                            width="1800"
                            height="1323"
                            decoding="async"
                            fetchpriority="high"
                            class="aspect-4/3 w-full rounded-2xl border border-accent-bg object-cover shadow-raised"
                        >
                        <div
                            class="absolute bottom-4 left-4 max-w-[16rem] rounded-xl border
                                border-accent-bg bg-secondary-bg/95 p-3 shadow-raised backdrop-blur-sm"
                        >
                            <p class="m-0 text-sm/snug">
                                <span class="block font-semibold text-primary-text">{{ copy.badgeTitle }}</span>
                                <span class="text-primary-text-muted">{{ copy.badgeDetail }}</span>
                            </p>
                        </div>
                    </figure>
                </div>
                <ul class="page-container mt-10 grid list-none gap-3 p-0 landscape:grid-cols-3">
                    <li
                        v-for="item in copy.highlights"
                        :key="item"
                        class="card flex items-center p-4 text-sm font-semibold"
                    >
                        {{ item }}
                    </li>
                </ul>
            </div>
        </section>

        <nav
            :aria-label="copy.sectionNavLabel"
            class="px-6 pb-2 landscape:hidden landscape:px-12"
        >
            <ul class="page-container m-0 flex list-none flex-wrap gap-2 p-0">
                <li
                    v-for="section in sections"
                    :key="section.id"
                >
                    <a
                        :href="`#${section.id}`"
                        class="chip h-11 px-4 hover:border-primary hover:bg-primary/5"
                    >
                        {{ section.label }}
                    </a>
                </li>
            </ul>
        </nav>

        <section
            id="about"
            class="scroll-mt-24 border-y border-accent-bg bg-secondary-bg"
        >
            <div class="page-section">
                <div class="page-container grid gap-8 landscape:grid-cols-2 landscape:gap-16">
                    <div class="flex flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.aboutEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.aboutTitle }}
                        </h2>
                    </div>
                    <div class="flex flex-col gap-4 text-primary-text-muted">
                        <p
                            v-for="paragraph in copy.about"
                            :key="paragraph"
                        >
                            {{ paragraph }}
                        </p>
                        <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
                            <li
                                v-for="language in content.languages"
                                :key="language.code"
                                class="chip h-auto min-h-8 max-w-full py-1 wrap-anywhere whitespace-normal"
                            >
                                {{ language.native }}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <section
            id="doctors"
            class="scroll-mt-24"
        >
            <div class="page-section">
                <div class="page-container flex flex-col gap-8">
                    <header class="flex max-w-2xl flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.doctorsEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.doctorsTitle }}
                        </h2>
                    </header>
                    <article
                        v-for="(doctor, index) in content.doctors"
                        :key="doctor.nameEn"
                        class="card grid items-center gap-8 p-6 landscape:p-10"
                        :class="index % 2 === 1
                            ? 'landscape:grid-cols-[16rem_minmax(0,1fr)]'
                            : 'landscape:grid-cols-[minmax(0,1fr)_16rem]'"
                    >
                        <img
                            :src="doctor.image"
                            :alt="copy.doctorCopy[index]?.alt"
                            width="800"
                            height="800"
                            loading="lazy"
                            decoding="async"
                            class="aspect-square w-full max-w-56 justify-self-center rounded-xl object-cover landscape:max-w-none"
                            :class="index % 2 === 1 ? 'landscape:order-first' : 'landscape:order-last'"
                            :style="{ objectPosition: doctor.position }"
                        >
                        <div :class="index % 2 === 1 ? 'landscape:order-last' : ''">
                            <p class="text-xl font-bold text-primary">
                                {{ copy.doctorCopy[index]?.tag }}
                            </p>
                            <div class="mt-4 flex flex-col gap-3 text-primary-text-muted">
                                <p
                                    v-for="paragraph in copy.doctorCopy[index]?.paragraphs"
                                    :key="paragraph"
                                >
                                    {{ paragraph }}
                                </p>
                            </div>
                            <p class="mt-6 border-t border-dashed border-accent-bg pt-4 text-right">
                                <span class="block text-sm text-primary-text-muted">{{ copy.doctorCopy[index]?.role }}</span>
                                <span class="block text-lg font-bold tracking-wide">{{ doctor.nameJa }}</span>
                                <span class="block text-xs tracking-widest text-primary-text-muted">{{ doctor.nameEn }}</span>
                            </p>
                        </div>
                    </article>
                </div>
            </div>
        </section>

        <section
            id="cases"
            class="scroll-mt-24 border-y border-accent-bg bg-secondary-bg"
        >
            <div class="page-section">
                <div class="page-container flex flex-col gap-8">
                    <header class="flex max-w-2xl flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.casesEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.casesTitle }}
                        </h2>
                        <p class="section-lead">
                            {{ copy.casesLead }}
                        </p>
                    </header>
                    <ul class="m-0 grid list-none gap-3 p-0 landscape:grid-cols-3">
                        <li
                            v-for="item in copy.cases"
                            :key="item.title"
                            class="rounded-xl border border-accent-bg bg-primary-bg p-5"
                        >
                            <h3 class="text-base font-semibold">
                                {{ item.title }}
                            </h3>
                            <p class="mt-1 text-sm text-primary-text-muted">
                                {{ item.detail }}
                            </p>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <section
            id="notice"
            class="scroll-mt-24"
        >
            <div class="page-section">
                <div class="page-container flex flex-col gap-8">
                    <header class="flex max-w-2xl flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.noticeEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.noticeTitle }}
                        </h2>
                        <p class="section-lead">
                            {{ copy.noticeLead }}
                        </p>
                    </header>
                    <ul class="m-0 grid list-none gap-4 p-0 landscape:grid-cols-2">
                        <li
                            v-for="notice in copy.notices"
                            :key="notice.title"
                            class="card p-6"
                        >
                            <h3 class="text-lg font-semibold">
                                {{ notice.title }}
                            </h3>
                            <p class="mt-2 text-primary-text-muted">
                                {{ notice.detail }}
                            </p>
                            <a
                                v-if="notice.feesLink"
                                href="#fees"
                                class="link mt-3 inline-flex min-h-11 items-center"
                            >
                                {{ copy.feesLink }}
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <section
            id="fees"
            class="scroll-mt-24 border-y border-accent-bg bg-secondary-bg"
        >
            <div class="page-section">
                <div class="page-container flex flex-col gap-8">
                    <header class="flex max-w-2xl flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.feesEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.feesTitle }}
                        </h2>
                        <p class="section-lead">
                            {{ copy.feesLead }}
                        </p>
                    </header>
                    <div class="grid gap-4 landscape:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div class="rounded-2xl bg-primary p-6 text-primary-text-inverted shadow-raised landscape:p-8">
                            <p class="text-xs font-semibold tracking-wide text-primary-text-inverted/80 uppercase">
                                {{ copy.rangeLabel }}
                            </p>
                            <div
                                v-for="(plan, index) in copy.plans"
                                :key="plan.note"
                                :class="index === 0 ? 'mt-4 border-b border-primary-text-inverted/20 pb-4' : 'pt-4'"
                            >
                                <p class="text-3xl font-bold tabular-nums">
                                    {{ plan.amount }}
                                </p>
                                <p
                                    class="mt-2 inline-block rounded-full bg-primary-text-inverted/15
                                        px-3 py-1 text-sm font-semibold"
                                >
                                    {{ plan.note }}
                                </p>
                            </div>
                        </div>
                        <div class="card overflow-hidden">
                            <p class="bg-primary/10 px-5 py-3 text-xs font-semibold tracking-wide text-primary uppercase">
                                {{ copy.includedLabel }}
                            </p>
                            <ul class="m-0 list-none p-0">
                                <li
                                    v-for="fee in copy.fees"
                                    :key="fee"
                                    class="border-t border-accent-bg px-5 py-4 font-semibold"
                                >
                                    {{ fee }}
                                </li>
                            </ul>
                            <p class="border-t border-accent-bg bg-primary-bg px-5 py-4 text-sm text-primary-text-muted">
                                {{ copy.referralNote }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section
            id="flow"
            class="scroll-mt-24"
        >
            <div class="page-section">
                <div class="page-container flex flex-col gap-8">
                    <header class="flex max-w-2xl flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.flowEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.flowTitle }}
                        </h2>
                    </header>
                    <ol class="m-0 grid list-none gap-4 p-0 landscape:grid-cols-4">
                        <li
                            v-for="(step, index) in copy.steps"
                            :key="step.title"
                            class="card p-5"
                        >
                            <span
                                class="grid size-8 place-items-center rounded-lg bg-primary
                                    text-sm font-bold text-primary-text-inverted"
                            >
                                {{ index + 1 }}
                            </span>
                            <h3 class="mt-4 text-base font-semibold">
                                {{ step.title }}
                            </h3>
                            <p class="mt-2 text-sm text-primary-text-muted">
                                {{ step.detail }}
                            </p>
                        </li>
                    </ol>
                </div>
            </div>
        </section>

        <section
            id="book"
            class="scroll-mt-24 border-t border-accent-bg bg-secondary-bg"
        >
            <div class="page-section">
                <div class="page-container flex flex-col gap-8">
                    <header class="flex max-w-2xl flex-col gap-3">
                        <p class="eyebrow">
                            {{ copy.bookEyebrow }}
                        </p>
                        <h2 class="section-heading">
                            {{ copy.bookTitle }}
                        </h2>
                        <p class="section-lead">
                            {{ copy.bookLead }}
                        </p>
                    </header>
                    <p class="rounded-xl bg-primary/10 p-4 text-sm text-primary">
                        {{ copy.bookNote }}
                    </p>
                    <div class="rounded-2xl bg-primary px-6 py-10 text-center text-primary-text-inverted">
                        <h2 class="text-2xl font-bold landscape:text-3xl">
                            {{ copy.ctaTitle }}
                        </h2>
                        <p class="mx-auto mt-3 max-w-xl text-primary-text-inverted/85">
                            {{ copy.ctaLead }}
                        </p>
                        <button
                            type="button"
                            class="btn btn-on-primary mt-6"
                            data-testid="clinic-landing-book-cta"
                            @click="onBook"
                        >
                            {{ copy.ctaButton }}
                        </button>
                    </div>
                    <p
                        class="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-primary-text"
                        data-testid="clinic-landing-emergency"
                    >
                        {{ copy.emergency }}
                    </p>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClinicSiteStatus, type ClinicSite } from '@findadoc/graphql'
import { createError, navigateTo, useAsyncData, useCookie, useHead, useRoute } from '#imports'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { useUmami } from '~/composables/useUmamiTracking'
import {
    clinicLandingHostSlug,
    clinicLandingShareImage,
    clinicSiteFetchIsServer,
    clinicPageLocaleCodes,
    clinicSubdomainHreflang,
    clinicSubdomainUrl
} from '~/utils/clinicLanding'
import { bookingClinicPath, findadocBookUrl } from '~/utils/booking/paths'
import { fetchClinicSite } from '~/utils/clinicSiteQuery'
import { clinicThemeVars } from '~/utils/clinicTheme'
import { DEFAULT_LOCALE_CODE, localizedPath } from '~/utils/localePath'
import { openGraphLocale } from '~/utils/seo'
import { formatPageTitle } from '~/utils/site'
import { jsonLdScript, medicalClinicJsonLd } from '~/utils/structuredData'

/**
 * One hosted clinic page. `/clinic/{slug}` on the main site and `/` on
 * `{slug}.findadoc.jp` both render this. The caller has already passed the
 * preview gate; a slug the API does not know is a 404 here.
 */
const props = defineProps<{
    slug: string
}>()

const { locale } = useI18n()
const route = useRoute()

/** `detectBrowserLanguage.cookieKey` in nuxt.config.ts. */
const I18N_LOCALE_COOKIE = 'i18n_redirected'
const { track } = useUmami()
const { host, hostname } = useRequestHost()
const mode = useClinicLandingMode()

/**
 * The clinic host serves the homepage payload. `useAsyncData` can settle
 * empty during that hydration while the GraphQL request is still in flight,
 * and a 404 here leaves only the layout footer. Fetch the row ourselves.
 */
async function loadLanding(): Promise<ClinicSite | null> {
    if (clinicSiteFetchIsServer(mode, hostname)) {
        const { data } = await useAsyncData(
            `clinic-site-${props.slug}`,
            () => fetchClinicSite(props.slug)
        )
        return data.value ?? null
    }
    return fetchClinicSite(props.slug)
}

const landing = await loadLanding()
if (landing === null) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

/**
 * Site locales this clinic has copy for. The switcher offers only these, and a URL
 * in any other locale goes to the English page instead of showing English copy
 * under a foreign prefix.
 */
const siteLocaleCodes = landing.locales.map(item => item.locale)
if (!siteLocaleCodes.includes(String(locale.value)) && siteLocaleCodes.includes(DEFAULT_LOCALE_CODE)) {
    // `/` follows i18n_redirected, which this visit just set to the unsupported locale.
    // Point it at English too, or the clinic host's `/` sends the visitor straight back.
    useCookie(I18N_LOCALE_COOKIE, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }).value = DEFAULT_LOCALE_CODE
    await navigateTo(localizedPath(route.fullPath, DEFAULT_LOCALE_CODE), { replace: true, redirectCode: 302 })
}

/** Copy in the site locale, or English when that locale has no row yet. */
const localeCopy = computed(() => {
    const code = String(locale.value)
    const matched = landing.locales.find(item => item.locale === code)
    return matched ?? landing.locales.find(item => item.locale === DEFAULT_LOCALE_CODE)
})

const firstCopy = localeCopy.value
if (firstCopy === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

// Narrowed once at setup. A later locale with no row keeps the copy that already rendered.
const copy = computed(() => localeCopy.value ?? firstCopy)

const content = {
    hero: landing.heroPath,
    languages: landing.languages,
    doctors: landing.doctors.map(doctor => ({
        nameJa: doctor.nameJa,
        nameEn: doctor.nameEn,
        image: doctor.imagePath,
        position: doctor.objectPosition
    }))
}

const themeStyle = clinicThemeVars(landing.theme.primary)
const bookingClinicId = landing.facilityId ?? landing.id

const sections = computed(() => [
    { id: 'doctors', label: copy.value.navDoctors },
    { id: 'cases', label: copy.value.navCases },
    { id: 'fees', label: copy.value.navFees },
    { id: 'flow', label: copy.value.navFlow },
    { id: 'book', label: copy.value.book }
])

function onBook() {
    track('Clinic landing book')
    const localeCode = String(locale.value)
    const clinicId = bookingClinicId
    if (clinicLandingHostSlug(hostname) === props.slug) {
        // The preview cookie is per host. This visitor passed the gate here, so carry
        // `?preview=1` to Find a Doc, whose Book page has the same gate.
        void navigateTo(findadocBookUrl(clinicId, {
            localeCode,
            requestHost: host,
            preview: mode === 'preview' ? '1' : undefined
        }), { external: true })
        return
    }
    void navigateTo(bookingClinicPath(clinicId, localeCode))
}

const shareImage = clinicLandingShareImage(landing.shareImagePath)
const indexable = mode === 'public' && landing.status === ClinicSiteStatus.Published

const pageLocaleCodes = clinicPageLocaleCodes(siteLocaleCodes)

useHead(() => {
    const current = copy.value
    const titled = formatPageTitle(current.name)
    const currentLocale = String(locale.value)
    return {
        title: current.name,
        // A preview page stays out of the hreflang cluster, as app.vue does for noindex routes.
        link: indexable ? clinicSubdomainHreflang(landing.slug, host, pageLocaleCodes) : [],
        meta: [
            ...pageLocaleCodes
                .filter(code => code !== currentLocale)
                .map(code => ({
                    key: `og:locale:${code}`,
                    property: 'og:locale:alternate',
                    content: openGraphLocale(code)
                })),
            { key: 'robots', name: 'robots', content: indexable ? 'index, follow' : 'noindex' },
            { key: 'description', name: 'description', content: current.description },
            { key: 'og:description', property: 'og:description', content: current.description },
            { key: 'twitter:description', name: 'twitter:description', content: current.description },
            { key: 'og:title', property: 'og:title', content: titled },
            { key: 'twitter:title', name: 'twitter:title', content: titled },
            { key: 'og:image', property: 'og:image', content: shareImage },
            { key: 'og:image:secure_url', property: 'og:image:secure_url', content: shareImage },
            { key: 'og:image:alt', property: 'og:image:alt', content: current.heroAlt },
            { key: 'twitter:image', name: 'twitter:image', content: shareImage },
            { key: 'twitter:image:alt', name: 'twitter:image:alt', content: current.heroAlt }
        ],
        script: [
            jsonLdScript('ld-clinic-landing', medicalClinicJsonLd({
                name: current.name,
                pagePath: clinicSubdomainUrl(landing.slug, { localeCode: String(locale.value), requestHost: host }),
                availableLanguage: landing.languages.map(language => language.bcp47)
            }))
        ]
    }
})
</script>
