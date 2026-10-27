<template>
    <div class="mod-create-facility-hp-topbar flex h-full w-full min-w-0 justify-end">
        <div
            class="facility-hp-topbar-actions flex w-full min-w-0 max-w-full flex-wrap justify-end gap-2 p-2 font-bold"
        >
            <button
                type="button"
                :class="[buttonBaseClass, buttonPrimaryClass, buttonPaddingClass]"
                data-testid="mod-create-facility-hp-topbar-create"
                @click="createFacilityOrHealthcareProfessional"
            >
                {{ t('modCreateFacilityOrHPTopbar.create') }}
            </button>
            <button
                type="button"
                :class="[buttonBaseClass, buttonOutlineClass, buttonPaddingClass]"
                data-testid="mod-create-facility-hp-topbar-exit"
                @click="openExitConfirmation"
            >
                {{ t('modCreateFacilityOrHPTopbar.exit') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useAppToast } from '~/composables/useAppToast'
import { useRouter } from 'vue-router'
import { useI18n } from '#imports'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useModerationScreenStore } from '~/stores/moderationScreenStore'
import { useModalStore } from '~/stores/modalStore'
import { handleModerationResponseErrors } from '~/composables/useModerationResponseHandling'
import { returnWithSuccessToast } from '~/composables/useModerationActionFeedback'
import { guardWithErrorToast } from '~/composables/useModerationGuardFeedback'
import { formErrorKey } from '~/utils/formErrorMessage'
import { hasEnglishLocalizedName } from '~/utils/nameUtils'
import { leaveToModerationDashboard } from '~/utils/moderationUtils'
import {
    hasRequiredHealthcareProfessionalSelections,
    validateModerationFacilityFields
} from '~/utils/moderationFormValidationUtils'

const router = useRouter()

// Initialize the stores in use
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const facilitiesStore = useFacilitiesStore()
const moderationScreenStore = useModerationScreenStore()
const modalStore = useModalStore()

const toast = useAppToast()

const { t } = useI18n()
const buttonBaseClass = 'inline-flex min-h-11 w-full min-w-0 max-w-full flex-1 basis-[calc(50%-0.25rem)]'
  + ' items-center justify-center rounded-full border-2'
  + ' break-words text-center text-sm font-bold leading-tight'
  + ' landscape:w-auto landscape:max-w-full landscape:flex-none landscape:basis-auto landscape:text-base'
const buttonPaddingClass = 'px-3 py-2 whitespace-normal landscape:px-5'
const buttonOutlineClass = 'bg-secondary-bg border-primary-text-muted text-primary-text hover:bg-accent-bg/20'
const buttonPrimaryClass = 'bg-primary border-primary text-primary-text-inverted hover:bg-primary-hover'

const validateFacilityFields = () => validateModerationFacilityFields(facilitiesStore.createFacilityFields)

const validateHealthcareProfessionalFields = () => {
    const healthcareProfessionalFields = healthcareProfessionalsStore.createHealthcareProfessionalSectionFields

    const areFacilityIdsAdded = !!healthcareProfessionalFields.facilityIds.length
    return areFacilityIdsAdded
      && hasRequiredHealthcareProfessionalSelections(healthcareProfessionalFields)
}

const createFacilityOrHealthcareProfessional = async () => {
    if (moderationScreenStore.createHealthcareProfessionalScreenIsActive()) {
        const healthcareProfessionalCreationSectionFields = healthcareProfessionalsStore.createHealthcareProfessionalSectionFields
        const hasEnglishName = hasEnglishLocalizedName(healthcareProfessionalCreationSectionFields.names)

        const hasAllRequiredFields = validateHealthcareProfessionalFields()

        if (guardWithErrorToast(
            !hasEnglishName,
            toast,
            t,
            formErrorKey.englishNameRequired
        )) {
            return
        }

        if (guardWithErrorToast(
            !hasAllRequiredFields,
            toast,
            t,
            formErrorKey.healthcareProfessionalFieldsIncomplete
        )) {
            return
        }

        const response = await healthcareProfessionalsStore.createHealthcareProfessional()

        if (handleModerationResponseErrors(response, toast, t)) {
            return response
        }

        returnWithSuccessToast(
            response,
            toast,
            t,
            'modCreateFacilityOrHPTopbar.healthcareProfessionalCreatedSuccessfully'
        )
        await leaveToModerationDashboard(router, moderationScreenStore)
        healthcareProfessionalsStore.resetCreateHealthcareProfessionalFields()
        return response
    }

    if (moderationScreenStore.createFacilityScreenIsActive()) {
        const validateCreateFacilityFields = validateFacilityFields()
        if (guardWithErrorToast(
            !validateCreateFacilityFields,
            toast,
            t,
            formErrorKey.facilityFieldsIncomplete
        )) {
            return
        }
        const response = await facilitiesStore.createFacility()

        if (handleModerationResponseErrors(response, toast, t)) {
            return response
        }

        returnWithSuccessToast(
            response,
            toast,
            t,
            'modCreateFacilityOrHPTopbar.facilityCreatedSuccessfully'
        )
        await leaveToModerationDashboard(router, moderationScreenStore)
        facilitiesStore.resetCreateFacilityFields()
        return response
    }
}

const navigateBackToDashboardWithoutCreation = async () => {
    if (moderationScreenStore.createHealthcareProfessionalScreenIsActive()) {
        healthcareProfessionalsStore.resetCreateHealthcareProfessionalFields()
    }
    if (moderationScreenStore.createFacilityScreenIsActive()) {
        facilitiesStore.resetCreateFacilityFields()
    }
    await leaveToModerationDashboard(router, moderationScreenStore, modalStore)
}

const openExitConfirmation = () => {
    useNuxtApp().$withConfirmation(() => {
        void navigateBackToDashboardWithoutCreation()
    }, {
        title: t('unsavedChanges.create.title'),
        message: t('modCreateFacilityOrHPTopbar.unsavedChangesMessage'),
        textConfirm: t('modCreateFacilityOrHPTopbar.confirmExit'),
        textCancel: t('unsavedChanges.create.cancel')
    })
}
</script>
