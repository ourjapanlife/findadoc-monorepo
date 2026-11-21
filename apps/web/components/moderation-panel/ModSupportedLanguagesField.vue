<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-languages"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modFacilitySection.supportedLanguagesLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modFacilitySection.supportedLanguagesHint') }}
        </p>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
            <label
                v-for="language in languageOptions"
                :key="language"
                class="flex items-center gap-2 text-sm text-primary-text"
            >
                <input
                    :data-testid="`mod-facility-section-language-${language}`"
                    type="checkbox"
                    :checked="languages.includes(language)"
                    :disabled="!isEditing"
                    @change="onLanguageChange(language, $event)"
                >
                <span>{{ languageName(language, locale) }}</span>
            </label>
        </div>
    </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '#imports'
import type { Locale } from '@findadoc/graphql'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import { correctionLanguageOptions } from '~/utils/facilityCorrection'
import { toggleSupportedLanguage } from '~/utils/facilityLanguages'
import { languageName } from '~/utils/languageName'

/**
 * Languages the facility itself supports, with no named professional (#21). Search matches a
 * language-only filter on this list, so a facility with no doctors can still be found by language.
 */
const { t, locale } = useI18n()
const isEditing = useModerationFormEditing()

const languages = defineModel<Locale[]>({ required: true })

// Every language the API accepts, plus any the facility already lists so it can be removed.
const languageOptions = computed(() => correctionLanguageOptions(languages.value))

function onLanguageChange(language: Locale, event: Event) {
    const checked = event.target instanceof HTMLInputElement && event.target.checked
    languages.value = toggleSupportedLanguage(languages.value, language, checked, languageOptions.value)
}
</script>
