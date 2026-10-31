<template>
    <div
        class="relative"
        data-testid="locale-selector"
    >
        <label
            :for="selectId"
            class="sr-only"
        >{{ t('hamburgerMenu.languageDropdownTitle') }}</label>
        <select
            :id="selectId"
            v-model="selectedLocale"
            class="h-10 appearance-none rounded-lg border bg-secondary-bg pl-3 pr-8
                   text-sm font-medium transition-colors"
            :class="onPrimary
                ? 'border-transparent text-primary-text hover:bg-primary-bg'
                : 'border-border-strong text-primary-text hover:border-primary'"
        >
            <option
                v-for="localeOption in localeOptions"
                :key="localeOption.code"
                :data-testid="`locale-option-${localeOption.code}`"
                :value="localeOption.code"
            >
                {{ localeOption.simpleText }}
            </option>
        </select>
        <svg
            class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2"
            :class="onPrimary ? 'stroke-primary-text' : 'stroke-primary-text-muted'"
            viewBox="0 0 24 24"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    </div>
</template>

<script setup lang="ts">
// Nuxt vue-i18n documentation:
// https://i18n.nuxtjs.org/docs/v8/api/vue-i18n

import { computed, ref, useId, watch } from 'vue'
import type { Locale } from '#i18n'
import type { Locale as GqlLocale } from '@findadoc/graphql'
import { useLocaleStore } from '~/stores/localeStore'
import { useUmami } from '~/composables/useUmamiTracking'
import { siteLanguage } from '~/utils/analyticsEvents'

const props = defineProps<{
    onPrimary?: boolean
    /** vue-i18n codes to offer. A hosted clinic passes the locales it has copy for. Omit for every site locale. */
    localeCodes?: readonly string[]
}>()

const { t, locale, setLocale } = useI18n()
const localeStore = useLocaleStore()
const { track } = useUmami()
const selectId = useId()

const localeOptions = computed(() => {
    const codes = props.localeCodes
    if (codes === undefined) {
        return localeStore.mvpLocaleDisplayOptions
    }
    return localeStore.mvpLocaleDisplayOptions.filter(option => codes.includes(toI18nCode(option.code)))
})

function toGqlCode(code: string): string {
    return code.replace('-', '_')
}

function toI18nCode(code: string): string {
    return code.replace('_', '-')
}

// The URL is the locale. setLocale navigates to the prefixed path and writes
// i18n_redirected, so a later visit to `/` still lands on the chosen language.
const selectedLocale = ref(toGqlCode(locale.value))
localeStore.setLocale(selectedLocale.value as GqlLocale)

watch(locale, value => {
    const gqlCode = toGqlCode(String(value))
    if (selectedLocale.value !== gqlCode) {
        selectedLocale.value = gqlCode
    }
})

watch(selectedLocale, newLocale => {
    const i18nCode = toI18nCode(newLocale)
    if (i18nCode === locale.value) {
        return
    }
    localeStore.setLocale(newLocale as GqlLocale)
    void setLocale(i18nCode as Locale)
    const to = siteLanguage(newLocale)
    if (to) track('Language switched', { to })
})
</script>
