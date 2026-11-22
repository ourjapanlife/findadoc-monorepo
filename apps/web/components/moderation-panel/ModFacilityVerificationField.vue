<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-verification"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modFacilitySection.verificationLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modFacilitySection.verificationHint') }}
        </p>
        <label
            v-for="option in options"
            :key="option.value"
            class="flex items-start gap-2 text-sm text-primary-text"
        >
            <input
                v-model="choice"
                :data-testid="option.testId"
                class="mt-1"
                type="radio"
                :name="radioName"
                :value="option.value"
                :disabled="!isEditing || option.disabled"
            >
            <span>{{ option.label }}</span>
        </label>
        <p
            v-if="!hasCity"
            class="m-0 text-sm text-primary-text-muted"
            data-testid="mod-facility-section-verification-needs-city"
        >
            {{ t('modFacilitySection.verificationNeedsCity') }}
        </p>
    </fieldset>
</template>

<script setup lang="ts">
import { computed, useId, watch } from 'vue'
import { useI18n } from '#imports'
import { FacilityVerificationStatus } from '@findadoc/graphql'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import type { FacilityVerificationChoice } from '~/utils/facilityVerification'

/**
 * Unverified or confirmed. A confirmed clinic shows the small "See an error?" link instead of the
 * "Help us confirm this listing" card (docs/facility-corrections.md). The API confirms only a
 * facility with a city, so confirmed is unavailable until the form has one.
 */
const props = defineProps<{ hasCity: boolean }>()

const { t } = useI18n()
const isEditing = useModerationFormEditing()
const radioName = `facility-verification-${useId()}`

const choice = defineModel<FacilityVerificationChoice>({ required: true })

// Clearing the city takes the confirmation with it, as the API would.
watch(() => props.hasCity, hasCity => {
    if (!hasCity) {
        choice.value = FacilityVerificationStatus.Unverified
    }
})

const options = computed(() => [
    {
        value: FacilityVerificationStatus.Unverified,
        label: t('modFacilitySection.verificationUnverified'),
        testId: 'mod-facility-section-verification-unverified',
        disabled: false
    },
    {
        value: FacilityVerificationStatus.Confirmed,
        label: t('modFacilitySection.verificationConfirmed'),
        testId: 'mod-facility-section-verification-confirmed',
        disabled: !props.hasCity
    }
])
</script>
