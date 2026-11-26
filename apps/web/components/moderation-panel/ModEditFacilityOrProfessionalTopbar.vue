<template>
    <div class="flex w-full min-w-0 flex-col">
        <div
            class="facility-hp-topbar-actions flex w-full min-w-0 flex-col gap-2 p-2 font-bold
            landscape:flex-row landscape:items-center landscape:justify-between"
        >
            <div class="flex min-w-0 flex-wrap items-center gap-2">
                <button
                    type="button"
                    :class="[buttonBaseClass, backButtonClass, buttonOutlineClass, buttonPaddingClass]"
                    data-testid="mod-edit-facility-hp-topbar-back"
                    @click="navigateBackToDashboard"
                >
                    {{ t('modEditFacilityOrHPTopbar.back') }}
                </button>
                <ModCopyId
                    v-if="selectedId"
                    :id="selectedId"
                    :label="selectedIdLabel"
                />
            </div>
            <div
                class="grid w-full min-w-0 grid-cols-2 gap-2
                landscape:flex landscape:w-auto landscape:max-w-full landscape:flex-1 landscape:flex-wrap landscape:justify-end
                portrait:[&>*:last-child:nth-child(odd)]:col-span-2"
            >
                <button
                    type="button"
                    :disabled="!hasPendingChanges || pending"
                    :aria-busy="isPending('update')"
                    :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                    data-testid="mod-edit-facility-hp-topbar-update"
                    @click="run('update', saveChanges)"
                >
                    <ButtonSpinner v-if="isPending('update')" />
                    {{ t('modEditFacilityOrHPTopbar.update') }}
                </button>
                <button
                    type="button"
                    :disabled="!hasPendingChanges || pending"
                    :aria-busy="isPending('updateAndExit')"
                    :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                    data-testid="mod-edit-facility-hp-topbar-update-and-exit"
                    @click="run('updateAndExit', saveChangesAndExit)"
                >
                    <ButtonSpinner v-if="isPending('updateAndExit')" />
                    {{ t('modEditFacilityOrHPTopbar.updateAndExit') }}
                </button>
                <button
                    v-if="selectedIsArchived"
                    type="button"
                    :disabled="pending"
                    :aria-busy="isPending('unarchive')"
                    :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                    data-testid="mod-edit-facility-hp-topbar-unarchive"
                    @click="openUnarchiveConfirmation"
                >
                    <ButtonSpinner v-if="isPending('unarchive')" />
                    {{ t('modEditFacilityOrHPTopbar.unarchive') }}
                </button>
                <button
                    v-else
                    type="button"
                    :class="[buttonBaseClass, actionButtonClass, buttonDangerClass, buttonPaddingClass]"
                    data-testid="mod-edit-facility-hp-topbar-archive"
                    :disabled="pending || !selectedId"
                    @click="archiveDialogOpen = true"
                >
                    {{ t('modEditFacilityOrHPTopbar.archive') }}
                </button>
            </div>
        </div>
        <div
            v-if="selectedIsArchived"
            role="status"
            class="mx-2 mb-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-primary-text"
            data-testid="mod-edit-archived-banner"
        >
            <p class="font-bold">
                {{ t('modEditFacilityOrHPTopbar.archivedBannerTitle') }}
            </p>
            <p>
                {{ archivedBannerText }}
            </p>
            <p
                v-if="selectedArchivedReason"
                class="mt-1 whitespace-pre-line"
                data-testid="mod-edit-archived-reason"
            >
                {{ t('modEditFacilityOrHPTopbar.archivedReason', { reason: selectedArchivedReason }) }}
            </p>
        </div>
        <ModArchiveDialog
            :open="archiveDialogOpen"
            :title="archiveDialogTitle"
            :message="archiveDialogMessage"
            :pending="isPending('archive')"
            @cancel="archiveDialogOpen = false"
            @confirm="reason => run('archive', () => archiveSelected(reason))"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppToast } from '~/composables/useAppToast'
import { usePendingAction } from '~/composables/usePendingAction'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import ModCopyId from '~/components/moderation-panel/ModCopyId.vue'
import ModArchiveDialog from '~/components/moderation-panel/ModArchiveDialog.vue'
import { isArchived } from '~/utils/archive'
import { useRouter } from 'vue-router'
import { useI18n } from '#imports'
import { useFacilitiesStore, getChangedFacilityFieldsForUpdate } from '~/stores/facilitiesStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useModerationScreenStore, ModerationScreen } from '~/stores/moderationScreenStore'
import { useModalStore } from '~/stores/modalStore'
import { returnWithSuccessToast } from '~/composables/useModerationActionFeedback'
import { guardWithErrorToast } from '~/composables/useModerationGuardFeedback'
import { formErrorKey } from '~/utils/formErrorMessage'
import { handleModerationResponseErrors, toastUnexpectedModerationError } from '~/composables/useModerationResponseHandling'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'
import { ErrorCode } from '~/typedefs/serverResponse'
import { arraysAreEqual } from '~/utils/arrayUtils'
import { hasBothProfessionalNames } from '~/utils/professionalNames'
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

const selectedIdLabel = computed(() => (moderationScreenStore.editFacilityScreenIsActive()
    ? t('modCopyId.facilityId')
    : t('modCopyId.healthcareProfessionalId')))

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
const { pending, isPending, run } = usePendingAction()

const { t, te } = useI18n()

const buttonBaseClass = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 rounded-full border-2'
  + ' break-words text-center text-sm font-bold leading-tight landscape:text-base'
  + ' disabled:cursor-not-allowed disabled:opacity-50'
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
        } catch (error: unknown) {
            toastUnexpectedModerationError(error, toast, t)
            return
        }

        if (handleModerationResponseErrors(response, toast, t, te)) {
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
            const hasBothNames = hasBothProfessionalNames(
                healthcareProfessionalsStore.healthcareProfessionalSectionFields.names
            )
            if (guardWithErrorToast(
                !hasBothNames,
                toast,
                t,
                formErrorKey.professionalNamesRequired
            )) {
                return
            }
        }

        const response = await healthcareProfessionalsStore.updateHealthcareProfessional()

        if (handleModerationResponseErrors(response, toast, t, te)) {
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

const archiveDialogOpen = ref(false)

const selectedRecord = computed(() => (moderationScreenStore.editFacilityScreenIsActive()
    ? facilitiesStore.selectedFacilityData
    : healthcareProfessionalsStore.selectedHealthcareProfessionalData))

const selectedIsArchived = computed(() => isArchived(selectedRecord.value))
const selectedArchivedReason = computed(() => selectedRecord.value?.archivedReason ?? '')

const professionalName = computed(() => {
    const name = healthcareProfessionalsStore.selectedHealthcareProfessionalData?.names?.[0]
    return name === undefined ? '' : [name.firstName, name.lastName].filter(part => part).join(' ')
})

const archivedBannerText = computed(() => (moderationScreenStore.editFacilityScreenIsActive()
    ? t('modEditFacilityOrHPTopbar.archivedBannerFacility')
    : t('modEditFacilityOrHPTopbar.archivedBannerHealthcareProfessional')))

const archiveDialogTitle = computed(() => (moderationScreenStore.editFacilityScreenIsActive()
    ? t('modEditFacilityOrHPTopbar.archiveTitleFacility')
    : t('modEditFacilityOrHPTopbar.archiveTitleHealthcareProfessional')))

const archiveDialogMessage = computed(() => (moderationScreenStore.editFacilityScreenIsActive()
    ? t('modEditFacilityOrHPTopbar.archiveExplanationFacility', {
        id: selectedId.value,
        facility: facilitiesStore.selectedFacilityData?.nameEn ?? ''
    })
    : t('modEditFacilityOrHPTopbar.archiveExplanationHealthcareProfessional', {
        id: selectedId.value,
        healthcareProfessional: professionalName.value
    })))

/** Archives the open record with the reason from the dialog. The record stays, hidden from the public. */
const archiveSelected = async (reason: string) => {
    const archivingFacility = moderationScreenStore.editFacilityScreenIsActive()
    const response = archivingFacility
        ? await facilitiesStore.setFacilityArchived(selectedId.value, { reason })
        : await healthcareProfessionalsStore.setHealthcareProfessionalArchived(selectedId.value, { reason })

    // Patients with an upcoming visit must hear from the clinic first (#169).
    const upcoming = response.errors?.find(error => error.code === ErrorCode.FACILITY_HAS_UPCOMING_BOOKINGS)
    if (upcoming !== undefined) {
        toast.error(t('modEditFacilityOrHPTopbar.facilityHasUpcomingBookings', { count: upcoming.count ?? 0 }))
        return response
    }

    if (handleModerationResponseErrors(response, toast, t, te)) {
        return response
    }

    archiveDialogOpen.value = false
    return returnWithSuccessToast(
        response,
        toast,
        t,
        archivingFacility
            ? 'modEditFacilityOrHPTopbar.facilityArchivedSuccessfully'
            : 'modEditFacilityOrHPTopbar.healthcareProfessionalArchivedSuccessfully'
    )
}

const unarchiveSelected = async () => {
    const restoringFacility = moderationScreenStore.editFacilityScreenIsActive()
    const response = restoringFacility
        ? await facilitiesStore.setFacilityArchived(selectedId.value, null)
        : await healthcareProfessionalsStore.setHealthcareProfessionalArchived(selectedId.value, null)

    if (handleModerationResponseErrors(response, toast, t, te)) {
        return response
    }

    return returnWithSuccessToast(
        response,
        toast,
        t,
        restoringFacility
            ? 'modEditFacilityOrHPTopbar.facilityUnarchivedSuccessfully'
            : 'modEditFacilityOrHPTopbar.healthcareProfessionalUnarchivedSuccessfully'
    )
}

const openUnarchiveConfirmation = () => {
    const restoringFacility = moderationScreenStore.editFacilityScreenIsActive()
    useNuxtApp().$withConfirmation(async () => {
        // Awaited so the dialog keeps its spinner until the request finishes.
        await run('unarchive', unarchiveSelected)
    }, {
        title: t('modEditFacilityOrHPTopbar.unarchive'),
        message: restoringFacility
            ? t('modEditFacilityOrHPTopbar.unarchiveConfirmationFacility', {
                id: selectedId.value,
                facility: facilitiesStore.selectedFacilityData?.nameEn ?? ''
            })
            : t('modEditFacilityOrHPTopbar.unarchiveConfirmationHealthcareProfessional', {
                id: selectedId.value,
                healthcareProfessional: professionalName.value
            }),
        textConfirm: t('modEditFacilityOrHPTopbar.unarchive'),
        textCancel: t('common.cancel')
    })
}

const navigateBackToDashboard = () => {
    const dashboardView = getModerationDashboardViewForScreen(moderationScreenStore.activeScreen)
    moderationSubmissionUnsavedStore.runLeaveOr(() =>
        leaveToModerationDashboard(router, moderationScreenStore, modalStore, dashboardView))
}
</script>
