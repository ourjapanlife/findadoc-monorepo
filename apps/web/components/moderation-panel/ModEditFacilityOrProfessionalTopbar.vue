<template>
    <div
        class="facility-hp-topbar-actions flex w-full min-w-0 flex-col gap-2 p-2 font-bold
        landscape:flex-row landscape:items-center landscape:justify-between"
    >
        <button
            type="button"
            :class="[buttonBaseClass, backButtonClass, buttonOutlineClass, buttonPaddingClass]"
            data-testid="mod-edit-facility-hp-topbar-back"
            @click="navigateBackToDashboard"
        >
            {{ t('modEditFacilityOrHPTopbar.back') }}
        </button>
        <div
            class="grid w-full min-w-0 grid-cols-2 gap-2
            portrait:[&>*:last-child:nth-child(odd)]:col-span-2
            landscape:flex landscape:w-auto landscape:max-w-full landscape:flex-1 landscape:flex-wrap landscape:justify-end"
        >
            <button
                type="button"
                :disabled="!hasPendingChanges"
                :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                data-testid="mod-edit-facility-hp-topbar-update"
                @click="saveChanges"
            >
                {{ t('modEditFacilityOrHPTopbar.update') }}
            </button>
            <button
                type="button"
                :disabled="!hasPendingChanges"
                :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                data-testid="mod-edit-facility-hp-topbar-update-and-exit"
                @click="saveChangesAndExit"
            >
                {{ t('modEditFacilityOrHPTopbar.updateAndExit') }}
            </button>
            <button
                type="button"
                :class="[buttonBaseClass, actionButtonClass, buttonDangerClass, buttonPaddingClass]"
                data-testid="mod-edit-facility-hp-topbar-delete"
                @click="openDeleteConfirmation"
            >
                {{ t('modEditFacilityOrHPTopbar.delete') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppToast } from '~/composables/useAppToast'
import { useRouter } from 'vue-router'
import { useI18n } from '#imports'
import { useFacilitiesStore, getChangedFacilityFieldsForUpdate } from '~/stores/facilitiesStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useModerationScreenStore, ModerationScreen } from '~/stores/moderationScreenStore'
import { useModalStore } from '~/stores/modalStore'
import { returnWithSuccessToast } from '~/composables/useModerationActionFeedback'
import { guardWithErrorToast } from '~/composables/useModerationGuardFeedback'
import { handleModerationResponseErrors } from '~/composables/useModerationResponseHandling'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'
import { arraysAreEqual } from '~/utils/arrayUtils'
import { hasEnglishLocalizedName } from '~/utils/nameUtils'
import { hasServerErrors, leaveToModerationDashboard, getModerationDashboardViewForScreen } from '~/utils/moderationUtils'
import { useModerationSubmissionUnsavedStore } from '~/stores/moderationSubmissionUnsavedStore'

const router = useRouter()

// Initialize the stores in use
const facilitiesStore = useFacilitiesStore()
const { facilitySectionFields } = storeToRefs(facilitiesStore)
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const moderationScreenStore = useModerationScreenStore()
const moderationSubmissionUnsavedStore = useModerationSubmissionUnsavedStore()
const modalStore = useModalStore()

// Initialize the value of the selected Id based off of Moderation Screen
const selectedId: ComputedRef<string> = computed(() => setSelectedId())

// Deep snapshots (not live store refs). Topbar mounts before edit sections finish loading — capture once data exists.
const originalFacilityData: Ref<Facility | undefined> = ref()
const originalHealthcareProfessionalData: Ref<HealthcareProfessional | undefined> = ref()

watch(
    () => facilitiesStore.selectedFacilityId,
    () => {
        if (moderationScreenStore.editFacilityScreenIsActive()) {
            originalFacilityData.value = undefined
        }
    }
)

watch(
    () => facilitiesStore.selectedFacilityData,
    data => {
        if (!moderationScreenStore.editFacilityScreenIsActive()) return
        const id = facilitiesStore.selectedFacilityId
        if (!data || !id || data.id !== id) return
        if (originalFacilityData.value !== undefined) return
        originalFacilityData.value = JSON.parse(JSON.stringify(data)) as Facility
    },
    { immediate: true }
)

watch(
    () => healthcareProfessionalsStore.selectedHealthcareProfessionalId,
    () => {
        if (moderationScreenStore.editHealthcareProfessionalScreenIsActive()) {
            originalHealthcareProfessionalData.value = undefined
        }
    }
)

watch(
    () => healthcareProfessionalsStore.selectedHealthcareProfessionalData,
    data => {
        if (!moderationScreenStore.editHealthcareProfessionalScreenIsActive()) return
        const id = healthcareProfessionalsStore.selectedHealthcareProfessionalId
        if (!data || !id || data.id !== id) return
        if (originalHealthcareProfessionalData.value !== undefined) return
        originalHealthcareProfessionalData.value = JSON.parse(JSON.stringify(data)) as HealthcareProfessional
    },
    { immediate: true }
)

// Disable the buttons if there are no changes
const hasPendingChanges = computed(() => hasPendingFormChanges())

const toast = useAppToast()

const { t } = useI18n()

const buttonBaseClass = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-full border-2'
  + ' break-words text-center text-sm font-bold leading-tight landscape:text-base'
const actionButtonClass = 'w-full landscape:w-auto landscape:shrink-0'
const backButtonClass = 'w-auto shrink-0 self-start landscape:self-center'
const buttonPaddingClass = 'px-3 py-2 whitespace-normal landscape:px-5'
const buttonOutlineClass = 'bg-secondary-bg border-primary-text-muted text-primary-text hover:bg-accent-bg/20'
const buttonDangerClass = 'bg-secondary-bg border-error text-error hover:bg-error/10'

function setSelectedId() {
    switch (moderationScreenStore.activeScreen) {
        case ModerationScreen.EditFacility:
            return facilitiesStore.selectedFacilityId
        case ModerationScreen.EditHealthcareProfessional:
            return healthcareProfessionalsStore.selectedHealthcareProfessionalId
        default:
            return ''
    }
}

const hasFacilityFormChanges = (): boolean => {
    if (!originalFacilityData.value) return false

    const updatedFields = getChangedFacilityFieldsForUpdate(
        facilitySectionFields.value,
        originalFacilityData.value
    )

    return !!Object.keys(updatedFields).length
}

const hasHealthcareProfessionalFormChanges = () => {
    if (!originalHealthcareProfessionalData.value) return false // No match found, no changes to compare.

    const originalHealthcareProfessional = originalHealthcareProfessionalData.value

    const healthcareProfessionalSections = healthcareProfessionalsStore.healthcareProfessionalSectionFields

    // Compare each field in the `healthcareProfessionalSectionFields` object with the original data.
    const areThereUnsavedHealthcareProfessionalChanges
        = !arraysAreEqual(
            healthcareProfessionalSections.names,
            originalHealthcareProfessional.names
        )
        || !arraysAreEqual(
            healthcareProfessionalSections.acceptedInsurance,
            originalHealthcareProfessional.acceptedInsurance
        )
        || healthcareProfessionalSections.additionalInfoForPatients !== originalHealthcareProfessional.additionalInfoForPatients
        || healthcareProfessionalSections.createdDate
        !== originalHealthcareProfessional.createdDate
        || !arraysAreEqual(
            healthcareProfessionalSections.degrees,
            originalHealthcareProfessional.degrees
        )
        || healthcareProfessionalSections.id
        !== originalHealthcareProfessional.id
        || !arraysAreEqual(
            healthcareProfessionalSections.specialties,
            originalHealthcareProfessional.specialties
        )
        || !arraysAreEqual(
            healthcareProfessionalSections.spokenLanguages,
            originalHealthcareProfessional.spokenLanguages
        )
        || !arraysAreEqual(
            healthcareProfessionalSections.facilityIds,
            originalHealthcareProfessional.facilityIds
        )
        || healthcareProfessionalSections.updatedDate
        !== originalHealthcareProfessional.updatedDate
    return areThereUnsavedHealthcareProfessionalChanges
}

const hasPendingFormChanges = () => {
    if (moderationScreenStore.editFacilityScreenIsActive()) {
        return hasFacilityFormChanges()
    }

    if (moderationScreenStore.editHealthcareProfessionalScreenIsActive()) {
        return hasHealthcareProfessionalFormChanges()
    }
    return false
}

const saveChanges = async () => {
    if (moderationScreenStore.editFacilityScreenIsActive()) {
        if (!originalFacilityData.value) return

        if (!hasFacilityFormChanges()) return

        let response
        try {
            response = await facilitiesStore.updateFacility()
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            toast.error(message)
            return
        }

        if (handleModerationResponseErrors(response, toast, t)) {
            return response
        }

        // Updates the facility section values with the data saved in the database
        facilitiesStore.initializeFacilitySectionValues(response.data as Facility)
        const savedFacility = facilitiesStore.selectedFacilityData
        if (savedFacility) {
            originalFacilityData.value = JSON.parse(JSON.stringify(savedFacility)) as Facility
        }
        return returnWithSuccessToast(
            response,
            toast,
            t,
            'modEditFacilityOrHPTopbar.facilityUpdatedSuccessfully',
            { className: 'e2e-moderation-success-toast' }
        )
    }
    // This makes the on click update the facility if the screen is EditFacility
    if (moderationScreenStore.editHealthcareProfessionalScreenIsActive()) {
        // This prevents us from sending a requested unnecessarily if the user has not made changes
        if (!hasHealthcareProfessionalFormChanges()) return

        const namesDirty = !arraysAreEqual(
            healthcareProfessionalsStore.healthcareProfessionalSectionFields.names,
            originalHealthcareProfessionalData.value?.names ?? []
        )
        if (namesDirty) {
            const hasEnglishName = hasEnglishLocalizedName(
                healthcareProfessionalsStore.healthcareProfessionalSectionFields.names
            )
            if (guardWithErrorToast(
                !hasEnglishName,
                toast,
                t,
                'modEditFacilityOrHPTopbar.healthcareProfessionalEnglishNameRequired'
            )) {
                return
            }
        }

        const response = await healthcareProfessionalsStore.updateHealthcareProfessional()

        if (handleModerationResponseErrors(response, toast, t)) {
            return response
        }

        const savedHp = response.data
        if (savedHp) {
            originalHealthcareProfessionalData.value = JSON.parse(JSON.stringify(savedHp)) as HealthcareProfessional
        }
        return returnWithSuccessToast(
            response,
            toast,
            t,
            'modEditFacilityOrHPTopbar.healthcareProfessionalUpdatedSuccessfully',
            { className: 'e2e-moderation-success-toast' }
        )
    }
}

const saveChangesAndExit = async () => {
    const dashboardView = getModerationDashboardViewForScreen(moderationScreenStore.activeScreen)

    if (moderationScreenStore.editFacilityScreenIsActive()) {
        if (hasPendingFormChanges()) {
            const response = await saveChanges()
            if (response === undefined || hasServerErrors(response)) {
                return
            }
        }
        await leaveToModerationDashboard(router, moderationScreenStore, modalStore, dashboardView)
        return
    }
    if (moderationScreenStore.editHealthcareProfessionalScreenIsActive()) {
        if (hasPendingFormChanges()) {
            const response = await saveChanges()
            if (response === undefined || hasServerErrors(response)) {
                return
            }
        }
        await leaveToModerationDashboard(router, moderationScreenStore, modalStore, dashboardView)
    }
}

const openDeleteConfirmation = () => {
    const deletingFacility = moderationScreenStore.editFacilityScreenIsActive()
    const professional = healthcareProfessionalsStore.selectedHealthcareProfessionalData
    const name = professional?.names?.[0]
    const professionalName = name === undefined
        ? ''
        : [name.firstName, name.lastName].filter(part => part).join(' ')
    useNuxtApp().$withConfirmation(() => {
        void deleteFacilityOrHealthcareProfessional()
    }, {
        title: t('modEditFacilityOrHPTopbar.delete'),
        message: deletingFacility
            ? t('modEditFacilityOrHPTopbar.deleteConfirmationFacility', {
                id: selectedId.value,
                facility: facilitiesStore.selectedFacilityData?.nameEn
            })
            : t('modEditFacilityOrHPTopbar.deleteConfirmationHealthcareProfessional', {
                id: selectedId.value,
                healthcareProfessional: professionalName
            }),
        textConfirm: t('modEditFacilityOrHPTopbar.deleteButtonText'),
        textCancel: t('common.cancel'),
        destructive: true
    })
}

const deleteFacilityOrHealthcareProfessional = async () => {
    if (moderationScreenStore.editFacilityScreenIsActive()) {
        const deleteFacilityArgs = {
            id: selectedId.value
        }
        const response = await facilitiesStore.deleteFacility(deleteFacilityArgs)

        if (handleModerationResponseErrors(response, toast, t)) {
            return response
        }
        returnWithSuccessToast(
            response,
            toast,
            t,
            'modEditFacilityOrHPTopbar.facilityDeletedSuccessfully'
        )
        // Redirect to the dashboard since the facility no longer exists
        await leaveToModerationDashboard(router, moderationScreenStore, modalStore)
        return response
    }

    if (moderationScreenStore.editHealthcareProfessionalScreenIsActive()) {
        const deleteHealthcareProfessionalArgs = {
            id: selectedId.value
        }

        const response = await healthcareProfessionalsStore.deleteHealthcareProfessional(deleteHealthcareProfessionalArgs)

        if (handleModerationResponseErrors(response, toast, t)) {
            return response
        }

        returnWithSuccessToast(
            response,
            toast,
            t,
            'modEditFacilityOrHPTopbar.healthcareProfessionalDeletedSuccessfully'
        )
        // Redirect to the dashboard since the healthcare professional no longer exists
        await leaveToModerationDashboard(router, moderationScreenStore, modalStore)
        return response
    }
}

const navigateBackToDashboard = () => {
    const dashboardView = getModerationDashboardViewForScreen(moderationScreenStore.activeScreen)
    moderationSubmissionUnsavedStore.runLeaveOr(() =>
        leaveToModerationDashboard(router, moderationScreenStore, modalStore, dashboardView))
}
</script>
