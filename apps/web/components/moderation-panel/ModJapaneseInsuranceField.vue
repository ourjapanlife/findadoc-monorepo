<template>
    <div
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-japanese-insurance"
    >
        <label class="flex items-start gap-2 text-sm text-primary-text">
            <input
                v-model="notAccepted"
                data-testid="mod-facility-section-japanese-insurance-not-accepted"
                class="mt-1"
                type="checkbox"
                :disabled="!isEditing"
            >
            <span>
                <span class="font-medium">{{ t('modFacilitySection.japaneseInsuranceNotAccepted') }}</span>
                <span class="mt-1 block text-primary-text-muted">{{ t('modFacilitySection.japaneseInsuranceHint') }}</span>
            </span>
        </label>
        <ModInputField
            v-if="notAccepted"
            v-model="source"
            data-testid="mod-facility-section-japanese-insurance-source"
            :label="t('modFacilitySection.japaneseInsuranceSourceLabel')"
            type="text"
            :placeholder="t('modFacilitySection.japaneseInsuranceSourcePlaceholder')"
            :required="false"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '#imports'
import { JapaneseInsurance } from '@findadoc/graphql'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import type { JapaneseInsuranceChoice } from '~/utils/japaneseInsurance'

/**
 * One box: the clinic does not take Japanese public health insurance (self-pay only).
 * Unticked means it takes it. The source is optional: a link, or a note about a call.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()

const choice = defineModel<JapaneseInsuranceChoice>('choice', { required: true })
const source = defineModel<string>('source', { required: true })

const notAccepted = computed({
    get: () => choice.value === JapaneseInsurance.NotAccepted,
    set: checked => {
        choice.value = checked ? JapaneseInsurance.NotAccepted : JapaneseInsurance.Accepted
        if (!checked) {
            source.value = ''
        }
    }
})
</script>
