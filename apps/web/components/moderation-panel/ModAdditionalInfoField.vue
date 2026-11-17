<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-additional-info"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modFacilitySection.additionalInfoLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modFacilitySection.additionalInfoHint') }}
        </p>
        <label class="field-label flex flex-col gap-1">
            {{ t('modFacilitySection.additionalInfoEnLabel') }}
            <textarea
                v-model="english"
                lang="en"
                class="field field-textarea"
                data-testid="mod-facility-section-additional-info-en"
                :maxlength="ADDITIONAL_INFO_MAX_LENGTH"
                :readonly="!isEditing"
                :tabindex="isEditing ? undefined : -1"
            />
        </label>
        <label class="field-label flex flex-col gap-1">
            {{ t('modFacilitySection.additionalInfoJaLabel') }}
            <textarea
                v-model="japanese"
                lang="ja"
                class="field field-textarea"
                data-testid="mod-facility-section-additional-info-ja"
                :maxlength="ADDITIONAL_INFO_MAX_LENGTH"
                :readonly="!isEditing"
                :tabindex="isEditing ? undefined : -1"
            />
        </label>
        <p
            v-if="missingLanguage"
            class="m-0 text-sm text-error"
            role="alert"
            data-testid="mod-facility-section-additional-info-error"
        >
            {{ t('modFacilitySection.additionalInfoBothLanguages') }}
        </p>
    </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '#imports'
import { ADDITIONAL_INFO_MAX_LENGTH } from '@findadoc/utils'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'

/**
 * The facility's visitor note (#294). The moderator writes it in English and in Japanese:
 * Japanese readers see the Japanese note and every other locale sees the English one.
 * Both or neither; the API refuses one alone.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()

const english = defineModel<string>('english', { required: true })
const japanese = defineModel<string>('japanese', { required: true })

const missingLanguage = computed(() => Boolean(english.value.trim()) !== Boolean(japanese.value.trim()))
</script>
