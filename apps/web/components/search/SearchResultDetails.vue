<template>
    <div
        data-testid="search-result-details"
        class="flex flex-col gap-8"
    >
        <header class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
                <component
                    :is="heading"
                    id="search-details-title"
                    class="text-2xl/tight font-bold text-primary-text"
                >
                    {{ facilityName }}
                </component>
                <p
                    v-if="otherLanguageName"
                    class="m-0 text-lg text-primary-text-muted"
                    data-testid="clinic-other-name"
                >
                    {{ otherLanguageName }}
                </p>
                <p class="m-0 text-primary-text-muted">
                    {{ addressLine1 }}
                    <template v-if="addressLine2">
                        <br>{{ addressLine2 }}
                    </template>
                </p>
            </div>

            <div class="mt-1 flex flex-wrap gap-2">
                <a
                    v-if="phoneHref"
                    :href="`tel:${phoneHref}`"
                    data-testid="search-details-call"
                    class="btn btn-primary btn-sm"
                    @click="trackContact('Call clicked')"
                >
                    <SVGPhoneIcon
                        class="size-4 stroke-current"
                        aria-hidden="true"
                    />
                    {{ t('searchResultsDetails.callNow') }}
                </a>
                <a
                    v-if="website"
                    :href="website"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-secondary btn-sm"
                    @click="trackContact('Website clicked')"
                >
                    <SVGGlobeIcon
                        class="size-4 stroke-current"
                        aria-hidden="true"
                    />
                    {{ t('search.website') }}
                </a>
                <OpenMapsButton
                    v-if="mapsUrl"
                    :href="mapsUrl"
                    @click="trackContact('Maps clicked')"
                />
                <a
                    v-if="email"
                    :href="`mailto:${email}`"
                    class="btn btn-secondary btn-sm"
                    @click="trackContact('Email clicked')"
                >
                    <SVGEmailIcon
                        class="size-4 stroke-current"
                        aria-hidden="true"
                    />
                    {{ t('search.email') }}
                </a>
            </div>

            <dl
                v-if="phone || website || payment || facilityLanguages"
                class="m-0 flex flex-col gap-1 text-sm text-primary-text-muted"
            >
                <div
                    v-if="phone"
                    class="flex gap-2"
                >
                    <dt class="font-semibold">
                        {{ t('search.phone') }}
                    </dt>
                    <dd class="m-0 select-all">
                        {{ phone }}
                    </dd>
                </div>
                <div
                    v-if="website"
                    class="flex min-w-0 gap-2"
                >
                    <dt class="shrink-0 font-semibold">
                        {{ t('search.website') }}
                    </dt>
                    <dd class="m-0 min-w-0 truncate">
                        {{ websiteLabel }}
                    </dd>
                </div>
                <div
                    v-if="facilityLanguages"
                    class="flex gap-2"
                    data-testid="facility-languages"
                >
                    <dt class="shrink-0 font-semibold">
                        {{ t('search.languagesSpoken') }}
                    </dt>
                    <dd class="m-0 flex flex-col gap-0.5">
                        <span>{{ facilityLanguages }}</span>
                        <!-- Clinic-level languages are not a promise about any one doctor. -->
                        <span
                            class="text-xs"
                            data-testid="facility-languages-caveat"
                        >
                            {{ t('search.clinicLanguagesCaveat') }}
                        </span>
                    </dd>
                </div>
                <div
                    v-if="payment"
                    class="flex gap-2"
                    data-testid="facility-payment-options"
                >
                    <dt class="shrink-0 font-semibold">
                        {{ t('search.payment') }}
                    </dt>
                    <dd class="m-0">
                        {{ payment }}
                    </dd>
                </div>
            </dl>
            <JapaneseInsuranceNote :value="facility.japaneseInsurance" />
        </header>

        <!-- Hours and the note show only when a moderator has filled them (#294). -->
        <section
            v-if="hoursRows.length"
            class="flex flex-col gap-2"
            data-testid="facility-opening-hours"
            aria-labelledby="facility-opening-hours-title"
        >
            <h3
                id="facility-opening-hours-title"
                class="text-sm font-semibold tracking-wide text-primary-text-muted uppercase"
            >
                {{ t('openingHours.title') }}
            </h3>
            <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <template
                    v-for="row in hoursRows"
                    :key="row.day"
                >
                    <dt class="font-semibold text-primary-text">
                        {{ row.label }}
                    </dt>
                    <dd
                        class="m-0"
                        :class="row.closed ? 'text-primary-text-muted' : 'text-primary-text'"
                    >
                        {{ row.times }}
                    </dd>
                </template>
            </dl>
            <p class="m-0 text-xs text-primary-text-muted">
                {{ t('openingHours.disclaimer') }}
            </p>
        </section>

        <section
            v-if="note"
            class="flex flex-col gap-2"
            data-testid="facility-additional-info"
            aria-labelledby="facility-additional-info-title"
        >
            <h3
                id="facility-additional-info-title"
                class="text-sm font-semibold tracking-wide text-primary-text-muted uppercase"
            >
                {{ t('facilityAdditionalInfo.title') }}
            </h3>
            <p
                class="m-0 text-sm whitespace-pre-line text-primary-text"
                :lang="note.lang"
            >
                {{ note.text }}
            </p>
        </section>

        <!-- Hidden when the clinic lists doctors but the search filtered every one of them out. -->
        <section
            v-if="professionals.length || listsNoDoctors"
            class="flex flex-col gap-3"
        >
            <h3 class="text-sm font-semibold tracking-wide text-primary-text-muted uppercase">
                {{ professionalsCountText }}
            </h3>
            <!-- A clinic can be listed before anyone names a doctor there (#21). Say so rather than leave a bare heading. -->
            <div
                v-if="listsNoDoctors"
                data-testid="search-details-no-professionals"
                class="card flex flex-col gap-2 p-4"
            >
                <p class="m-0 text-primary-text">
                    {{ t('search.noProfessionalsNote') }}
                </p>
                <NuxtLink
                    to="/submit"
                    data-testid="search-details-add-professional"
                    class="self-start font-medium text-primary hover:underline"
                >
                    {{ t('search.addProfessional') }}
                </NuxtLink>
            </div>
            <ul
                v-else
                class="m-0 flex list-none flex-col gap-3 p-0"
            >
                <li
                    v-for="(professional, index) in visibleProfessionals"
                    :key="professional.id"
                    :ref="element => setProfessionalItem(element, index)"
                    data-testid="search-details-professional"
                    class="card flex flex-col gap-3 p-4"
                    tabindex="-1"
                >
                    <div class="flex flex-col">
                        <NuxtLink
                            :to="professional.path"
                            class="text-lg/snug font-semibold text-primary hover:underline"
                            @click="track('Doctor opened', { from: surface })"
                        >
                            {{ professional.name }}
                        </NuxtLink>
                        <p
                            v-if="professional.degrees"
                            class="m-0 text-sm text-primary-text-muted"
                        >
                            {{ professional.degrees }}
                        </p>
                    </div>
                    <p
                        v-if="professional.specialties"
                        class="m-0 text-primary-text"
                    >
                        {{ professional.specialties }}
                    </p>
                    <div
                        v-if="professional.languages.length"
                        class="flex flex-col gap-1.5"
                    >
                        <span class="text-xs font-semibold tracking-wide text-primary-text-muted uppercase">
                            {{ t('searchResultsDetails.speaks') }}
                        </span>
                        <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0">
                            <li
                                v-for="languageName in professional.languages"
                                :key="languageName"
                                class="chip chip-primary h-7 px-2.5 text-xs"
                            >
                                {{ languageName }}
                            </li>
                        </ul>
                    </div>
                    <p
                        v-if="professional.additionalInfo"
                        class="m-0 text-sm whitespace-pre-line text-primary-text-muted"
                    >
                        {{ professional.additionalInfo }}
                    </p>
                    <p
                        v-if="professional.updated"
                        class="m-0 text-xs text-primary-text-muted"
                    >
                        {{ t('searchResultsDetails.lastUpdate') }}: {{ professional.updated }}
                    </p>
                </li>
            </ul>
            <!--
                A clinic can list dozens of doctors. Show a page at a time so the correction prompt
                below the list stays in reach.
            -->
            <div
                v-if="hiddenProfessionalCount"
                class="flex flex-wrap gap-2"
            >
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-testid="search-details-show-more-professionals"
                    @click="showMoreProfessionals"
                >
                    {{ showMoreText }}
                </button>
                <button
                    v-if="hiddenProfessionalCount > PROFESSIONALS_PAGE_SIZE"
                    type="button"
                    class="btn btn-ghost btn-sm"
                    data-testid="search-details-show-all-professionals"
                    @click="showAllProfessionals"
                >
                    {{ showAllText }}
                </button>
            </div>
        </section>

        <!--
            Imported facilities and their map pins come from Ministry of Health data, used under
            公共データ利用規約 (PDL1.0): name each source with its page, and say we edited it.
        -->
        <i18n-t
            v-if="fromMinistryData"
            keypath="searchResultsDetails.sourceCredit"
            tag="p"
            scope="global"
            class="m-0 text-xs text-primary-text-muted"
            data-testid="facility-source-credit"
        >
            <template #list>
                <a
                    :href="MHLW_INSTITUTION_LIST_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline"
                >{{ t('searchResultsDetails.sourceInstitutionList') }}</a>
            </template>
            <template #openData>
                <a
                    :href="MHLW_OPEN_DATA_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline"
                >{{ t('searchResultsDetails.sourceOpenData') }}</a>
            </template>
        </i18n-t>
        <!--
            Imported facilities the ministry has no pin for are placed by street address with GSI's
            address search (国土地理院コンテンツ利用規約): credit the source.
        -->
        <i18n-t
            v-if="fromMinistryData"
            keypath="searchResultsDetails.pinCredit"
            tag="p"
            scope="global"
            class="m-0 text-xs text-primary-text-muted"
            data-testid="facility-pin-credit"
        >
            <template #gsi>
                <a
                    :href="GSI_ADDRESS_SEARCH_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline"
                >{{ t('searchResultsDetails.pinSourceGsi') }}</a>
            </template>
        </i18n-t>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { FacilitySource } from '@findadoc/graphql'
import OpenMapsButton from '~/components/common/OpenMapsButton.vue'
import SVGGlobeIcon from '~/assets/icons/globe-icon.svg'
import SVGPhoneIcon from '~/assets/icons/phone-icon.svg'
import SVGEmailIcon from '~/assets/icons/email-icon.svg'
import { useSpecialtiesStore } from '~/stores/specialtiesStore'
import { formatHealthcareProfessionalName } from '~/utils/nameUtils'
import { isJapaneseLocale, toGqlLocale } from '~/utils/activeLocale'
import { formatToReadableDate } from '~/utils/dateUtils'
import { useUmami } from '~/composables/useUmamiTracking'
import { noteSearchDetailsContact, type EventProps } from '~/utils/analyticsEvents'
import { professionalPath } from '~/utils/doctorPath'
import { formatPaymentOptions } from '~/utils/paymentOptions'
import { spokenLanguageNames } from '~/utils/languageName'
import { openingHoursRows, visitorNote } from '~/utils/openingHours'
import { facilityEmail,
    facilityMapsUrl,
    facilityPhone,
    facilityPhoneHref,
    facilityWebsiteLabel,
    facilityWebsiteUrl,
    type FacilitySearchResult } from '~/utils/searchDirectory'

const props = withDefaults(defineProps<{
    facility: FacilitySearchResult
    heading?: 'h1' | 'h2'
    surface?: EventProps['Call clicked']['surface']
}>(), {
    heading: 'h2',
    surface: 'search_details'
})

const { t, locale } = useI18n()
const specialtiesStore = useSpecialtiesStore()

// The ministry pages the credit links to (#21).
const MHLW_INSTITUTION_LIST_URL = 'https://www.mhlw.go.jp/stf/newpage_05774.html'
const MHLW_OPEN_DATA_URL = 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/newpage_43373.html'
const GSI_ADDRESS_SEARCH_URL = 'https://maps.gsi.go.jp/'

const fromMinistryData = computed(() => props.facility.source === FacilitySource.MhlwMultilingualInstitutions)
const { track } = useUmami()

// Keyed off vue-i18n, not localeStore: the store lags behind a cookie-driven locale.
const isJapanese = computed(() => isJapaneseLocale(locale.value))

const facilityName = computed(() => (isJapanese.value ? props.facility.nameJa : props.facility.nameEn) || props.facility.nameEn)

const otherLanguageName = computed(() => {
    const other = isJapanese.value ? props.facility.nameEn : props.facility.nameJa
    if (!other || other === facilityName.value) {
        return ''
    }
    return other
})

const address = computed(() => props.facility.contact?.address)

const addressLine1 = computed(() => {
    const value = address.value
    if (!value) return ''

    return isJapanese.value
        ? `${value.postalCode ?? ''} ${value.prefectureJa ?? ''}${value.cityJa ?? ''}${value.addressLine1Ja ?? ''}${value.addressLine2Ja ?? ''}`.trim()
        : `${value.addressLine1En ?? ''} ${value.addressLine2En ?? ''}`.trim()
})

const addressLine2 = computed(() => {
    const value = address.value
    if (!value || isJapanese.value) return ''

    return `${value.cityEn ?? ''}, ${value.prefectureEn ?? ''} ${value.postalCode ?? ''}`.trim()
})

/*
 * Every contact value goes through a normaliser rather than straight into an href. These are
 * volunteer-entered free text: websites arrive without a scheme (which an <a> reads as a
 * relative path, so the button silently navigated inside our own site), and several fields
 * carry placeholders like "none" that should show no control at all.
 */
const mapsUrl = computed(() => facilityMapsUrl(props.facility, isJapanese.value))
const website = computed(() => facilityWebsiteUrl(props.facility))
const websiteLabel = computed(() => facilityWebsiteLabel(props.facility))
const phone = computed(() => facilityPhone(props.facility, isJapanese.value))
const phoneHref = computed(() => facilityPhoneHref(props.facility))
const email = computed(() => facilityEmail(props.facility))
// Unknown payment is an empty list and shows nothing (#20).
const payment = computed(() => formatPaymentOptions(props.facility.paymentOptions, t))

// Languages the clinic itself supports, with or without a named doctor (#19, #21). Empty shows nothing.
const facilityLanguages = computed(() => spokenLanguageNames(props.facility.supportedLanguages ?? [], locale.value)
    .join(', '))

// Unknown hours are an empty list and show nothing. The note follows the reader's language (#294).
const hoursRows = computed(() => openingHoursRows(props.facility.openingHours, t))
const note = computed(() => visitorNote(props.facility, isJapanese.value))

const professionals = computed(() => props.facility.healthcareProfessionals.map(professional => ({
    id: professional.id,
    path: professionalPath(professional),
    name: formatHealthcareProfessionalName(professional.names, toGqlLocale(locale.value)),
    degrees: (professional.degrees ?? []).join(', '),
    specialties: (professional.specialties ?? [])
        .map(code => specialtiesStore.specialtyDisplayOptions.find(option => option.code === code)?.displayText)
        .filter(Boolean)
        .join(', '),
    languages: spokenLanguageNames(professional.spokenLanguages ?? [], locale.value),
    additionalInfo: professional.additionalInfoForPatients ?? '',
    updated: professional.updatedDate ? formatToReadableDate(professional.updatedDate) : ''
})))

// In script rather than the template: i18n/cleanUnusedLocaleKeys.js only sees template t() calls with no second argument.
/*
 * On search, `healthcareProfessionals` holds only the doctors who match the filters. A language
 * search can match the clinic's own languages and none of its doctors (#21).
 */
const listsNoDoctors = computed(() => !props.facility.healthcareProfessionals.length
  && !(props.facility.healthcareProfessionalIds ?? []).length)

const professionalsCountText = computed(() => t('search.professionalsAtFacility', professionals.value.length))

/** How many doctors the details show at first, and how many each "Show more" adds. */
const PROFESSIONALS_PAGE_SIZE = 5

const visibleProfessionalCount = ref(PROFESSIONALS_PAGE_SIZE)
const visibleProfessionals = computed(() => professionals.value.slice(0, visibleProfessionalCount.value))
const hiddenProfessionalCount = computed(() => Math.max(professionals.value.length - visibleProfessionalCount.value, 0))
const showMoreText = computed(() => t('search.showMoreProfessionals', {
    n: Math.min(hiddenProfessionalCount.value, PROFESSIONALS_PAGE_SIZE)
}))
const showAllText = computed(() => t('search.showAllProfessionals', { n: professionals.value.length }))

// The search panel reuses this component when the reader opens another clinic.
watch(() => props.facility.id, () => {
    visibleProfessionalCount.value = PROFESSIONALS_PAGE_SIZE
})

const professionalItems: HTMLElement[] = []

function setProfessionalItem(element: Element | ComponentPublicInstance | null, index: number) {
    if (element instanceof HTMLElement) {
        professionalItems[index] = element
    }
}

/** Reveals more doctors and moves focus to the first new one, so keyboard and screen reader users keep their place. */
async function revealProfessionals(count: number) {
    const firstNewIndex = visibleProfessionalCount.value
    visibleProfessionalCount.value = count
    await nextTick()
    professionalItems[firstNewIndex]?.focus()
}

function showMoreProfessionals() {
    return revealProfessionals(visibleProfessionalCount.value + PROFESSIONALS_PAGE_SIZE)
}

function showAllProfessionals() {
    return revealProfessionals(professionals.value.length)
}

function trackContact(name: 'Call clicked' | 'Website clicked' | 'Email clicked' | 'Maps clicked') {
    if (props.surface === 'search_details') noteSearchDetailsContact()
    track(name, { surface: props.surface })
}
</script>
