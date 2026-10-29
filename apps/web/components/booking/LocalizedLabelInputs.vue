<template>
    <div class="flex flex-col gap-2">
        <label class="flex flex-col">
            <span class="field-label">
                {{ props.label }}
                <span class="ml-1 font-normal text-primary-text-muted">({{ englishName }})</span>
            </span>
            <input
                :value="labels[CLINIC_LABEL_FALLBACK_LOCALE] ?? ''"
                type="text"
                class="field"
                maxlength="200"
                required
                :data-testid="props.testid"
                @input="setLabel(CLINIC_LABEL_FALLBACK_LOCALE, $event)"
            >
        </label>
        <details class="rounded-lg border border-accent-bg px-3 py-2">
            <summary class="cursor-pointer text-sm font-semibold text-primary-text">
                {{ t('clinicDashboard.forms.translations') }}
            </summary>
            <div class="mt-3 grid gap-3 landscape:grid-cols-2">
                <label
                    v-for="code in otherLocales"
                    :key="code"
                    class="flex flex-col"
                >
                    <span class="text-sm font-semibold text-primary-text">{{ languageName(code, uiLocale) }}</span>
                    <input
                        :value="labels[code] ?? ''"
                        type="text"
                        class="field"
                        maxlength="200"
                        :lang="code"
                        @input="setLabel(code, $event)"
                    >
                </label>
            </div>
        </details>
        <p
            v-if="missingLocales.length > 0"
            class="text-sm text-primary-text-muted"
        >
            {{ t('clinicDashboard.forms.shownInEnglish', {
                languages: missingLocales.map(code => languageName(code, uiLocale)).join(', '),
            }) }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CLINIC_LABEL_FALLBACK_LOCALE } from '~/utils/booking/clinicLabels'
import { languageName } from '~/utils/languageName'
import { LOCALE_CODES } from '~/utils/localePath'

/**
 * One clinic-written label in every site locale. English is required; a locale
 * left empty shows English on the Book page, and the note under the inputs says which.
 */
const props = defineProps<{
    label: string
    testid?: string
}>()

const labels = defineModel<Record<string, string>>({ required: true })

const { t, locale } = useI18n()
const uiLocale = computed(() => String(locale.value))
const englishName = computed(() => languageName(CLINIC_LABEL_FALLBACK_LOCALE, uiLocale.value))
const otherLocales = LOCALE_CODES.filter(code => code !== CLINIC_LABEL_FALLBACK_LOCALE)
const missingLocales = computed(() => otherLocales.filter(code => (labels.value[code] ?? '').trim() === ''))

function setLabel(code: string, event: Event): void {
    labels.value = { ...labels.value, [code]: (event.target as HTMLInputElement).value }
}
</script>
