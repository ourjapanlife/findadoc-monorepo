<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-healthcare-professional-section-gender"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modHealthcareProfessionalSection.genderLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modHealthcareProfessionalSection.genderHint') }}
        </p>
        <label
            v-for="option in options"
            :key="option.value"
            class="flex items-start gap-2 text-sm text-primary-text"
        >
            <input
                v-model="gender"
                :data-testid="option.testId"
                class="mt-1"
                type="radio"
                :name="radioName"
                :value="option.value"
                :disabled="!isEditing"
            >
            <span>{{ option.label }}</span>
        </label>
    </fieldset>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from '#imports'
import { Gender } from '@findadoc/graphql'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'

/**
 * A professional's gender (#224). Unknown is the default and means nobody has checked.
 * A moderator sets it only from a source, such as the clinic's site or a call, and never
 * guesses from a name or a photo. "Chose not to say" is an answer, not a blank.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()
const radioName = `professional-gender-${useId()}`

const gender = defineModel<Gender>({ required: true })

const options = computed<{ value: Gender, label: string, testId: string }[]>(() => [
    {
        value: Gender.Unknown,
        label: t('modHealthcareProfessionalSection.genderUnknown'),
        testId: 'mod-healthcare-professional-section-gender-unknown'
    },
    {
        value: Gender.Female,
        label: t('modHealthcareProfessionalSection.genderFemale'),
        testId: 'mod-healthcare-professional-section-gender-female'
    },
    {
        value: Gender.Male,
        label: t('modHealthcareProfessionalSection.genderMale'),
        testId: 'mod-healthcare-professional-section-gender-male'
    },
    {
        value: Gender.Unspecified,
        label: t('modHealthcareProfessionalSection.genderUnspecified'),
        testId: 'mod-healthcare-professional-section-gender-unspecified'
    }
])
</script>
