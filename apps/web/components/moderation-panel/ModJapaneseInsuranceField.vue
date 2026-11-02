<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-japanese-insurance"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modFacilitySection.japaneseInsuranceLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modFacilitySection.japaneseInsuranceHint') }}
        </p>
        <label
            v-for="option in options"
            :key="option.value || 'unknown'"
            class="flex items-start gap-2 text-sm text-primary-text"
        >
            <input
                v-model="selected"
                :data-testid="option.testId"
                class="mt-1"
                type="radio"
                :name="radioName"
                :value="option.value"
                :disabled="!isEditing"
            >
            <span>{{ option.label }}</span>
        </label>
        <ModInputField
            v-if="selected === JapaneseInsurance.NotAccepted"
            v-model="source"
            data-testid="mod-facility-section-japanese-insurance-source"
            :label="t('modFacilitySection.japaneseInsuranceSourceLabel')"
            type="text"
            :placeholder="t('modFacilitySection.japaneseInsuranceSourcePlaceholder')"
            :required="false"
        />
    </fieldset>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from '#imports'
import { JapaneseInsurance } from '@findadoc/graphql'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import type { JapaneseInsuranceChoice } from '~/utils/japaneseInsurance'

/**
 * Unknown, takes it, or does not take it (self-pay only) (#18). Unknown is the default and
 * the way to clear an answer. A self-pay-only answer may carry a source: a link, or a note
 * about a call. The API keeps the note only on that answer, so any other choice clears it.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()
const radioName = `japanese-insurance-${useId()}`

const choice = defineModel<JapaneseInsuranceChoice>('choice', { required: true })
const source = defineModel<string>('source', { required: true })

const options = computed<{ value: JapaneseInsuranceChoice, label: string, testId: string }[]>(() => [
    {
        value: '',
        label: t('modFacilitySection.japaneseInsuranceUnknown'),
        testId: 'mod-facility-section-japanese-insurance-unknown'
    },
    {
        value: JapaneseInsurance.Accepted,
        label: t('modFacilitySection.japaneseInsuranceAccepted'),
        testId: 'mod-facility-section-japanese-insurance-accepted'
    },
    {
        value: JapaneseInsurance.NotAccepted,
        label: t('modFacilitySection.japaneseInsuranceNotAccepted'),
        testId: 'mod-facility-section-japanese-insurance-not-accepted'
    }
])

const selected = computed({
    get: () => choice.value,
    set: value => {
        choice.value = value
        if (value !== JapaneseInsurance.NotAccepted) {
            source.value = ''
        }
    }
})
</script>
