<template>
    <div
        class="flex w-full min-w-0 flex-col gap-2 p-2 font-bold
        landscape:flex-row landscape:items-center landscape:justify-between"
    >
        <button
            type="button"
            data-testid="mod-edit-submission-back-to-dashboard"
            :class="[buttonBaseClass, backButtonClass, buttonOutlineClass, buttonPaddingClass]"
            @click="goToDashboard"
        >
            {{ t('modEditFacilityOrHPTopbar.back') }}
        </button>
        <div
            class="grid w-full min-w-0 grid-cols-2 gap-2
            landscape:flex landscape:w-auto landscape:max-w-full landscape:flex-1 landscape:flex-wrap landscape:justify-end"
        >
            <template v-if="!isCorrectionSelected">
                <button
                    type="button"
                    :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                    data-testid="submission-topNav-update"
                    :disabled="actionPending"
                    :aria-busy="isActionPending(ModerationSubmissionActionType.Update)"
                    @click="requestUpdate"
                >
                    <ButtonSpinner v-if="isActionPending(ModerationSubmissionActionType.Update)" />
                    {{ t('modEditSubmissionTopNav.update') }}
                </button>
                <button
                    type="button"
                    :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                    data-testid="submission-topNav-updateAndExit"
                    :disabled="actionPending"
                    :aria-busy="isActionPending(ModerationSubmissionActionType.UpdateAndExit)"
                    @click="requestUpdateAndExit"
                >
                    <ButtonSpinner v-if="isActionPending(ModerationSubmissionActionType.UpdateAndExit)" />
                    {{ t('modEditSubmissionTopNav.updateAndExit') }}
                </button>
            </template>
            <button
                data-testid="mod-edit-submission-reject-button"
                :disabled="actionPending"
                :aria-busy="isActionPending(ModerationSubmissionActionType.Reject)"
                type="button"
                :class="[buttonBaseClass, actionButtonClass, buttonDangerClass, buttonPaddingClass]"
                @click="requestRejectConfirmation"
            >
                <ButtonSpinner v-if="isActionPending(ModerationSubmissionActionType.Reject)" />
                {{ t('modEditSubmissionTopNav.reject') }}
            </button>
            <button
                type="button"
                data-testid="mod-edit-submission-approve-button"
                :disabled="actionPending"
                :aria-busy="isActionPending(ModerationSubmissionActionType.Approve)"
                :class="[buttonBaseClass, actionButtonClass, buttonPrimaryClass, buttonPaddingClass]"
                @click="requestApproveConfirmation"
            >
                <ButtonSpinner v-if="isActionPending(ModerationSubmissionActionType.Approve)" />
                {{ t('modEditSubmissionTopNav.approve') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ModerationSubmissionActionType, useModerationSubmissionActions } from '~/composables/useModerationSubmissionActions'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { leaveToModerationDashboard } from '~/utils/moderationUtils'
import { isCorrection } from '~/utils/moderationSubmissionStatus'
import { useModerationSubmissionsStore } from '~/stores/moderationSubmissionsStore'

const { t } = useI18n()
const router = useRouter()
const moderationScreenStore = useModerationScreenStore()
const modalStore = useModalStore()

const moderationSubmissionUnsavedStore = useModerationSubmissionUnsavedStore()
const { emitModerationSubmissionAction, moderationSubmissionPendingAction } = useModerationSubmissionActions()
const actionPending = computed(() => moderationSubmissionPendingAction.value !== null)
const isActionPending = (type: ModerationSubmissionActionType) => moderationSubmissionPendingAction.value === type
const moderationSubmissionsStore = useModerationSubmissionsStore()

// A correction has nothing to save: the moderator approves or declines what the visitor sent (#22).
const isCorrectionSelected = computed(() => {
    const selected = moderationSubmissionsStore.selectedSubmissionData
    return selected !== undefined && selected.id === moderationSubmissionsStore.selectedSubmissionId && isCorrection(selected)
})

const goToDashboard = () => {
    moderationSubmissionUnsavedStore.runLeaveOr(() =>
        leaveToModerationDashboard(router, moderationScreenStore, modalStore, 'submissions'))
}

const buttonBaseClass = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 rounded-full border-2'
  + ' break-words text-center text-sm font-bold leading-tight landscape:text-base'
  + ' disabled:cursor-not-allowed disabled:opacity-50'
const actionButtonClass = 'w-full landscape:w-auto landscape:shrink-0'
const backButtonClass = 'w-auto shrink-0 self-start landscape:self-center'
const buttonPaddingClass = 'px-3 py-2 whitespace-normal landscape:px-5'
const buttonOutlineClass = 'bg-secondary-bg border-primary-text-muted text-primary-text hover:bg-accent-bg/20'
const buttonPrimaryClass = 'bg-primary border-primary text-primary-text-inverted hover:bg-primary-hover'
const buttonDangerClass = 'bg-secondary-bg border-error text-error hover:bg-error/10'

const requestUpdateAndExit = () => {
    emitModerationSubmissionAction(ModerationSubmissionActionType.UpdateAndExit)
}

const requestUpdate = () => {
    emitModerationSubmissionAction(ModerationSubmissionActionType.Update)
}

const requestApproveConfirmation = () => {
    emitModerationSubmissionAction(ModerationSubmissionActionType.Approve)
}

const requestRejectConfirmation = () => {
    emitModerationSubmissionAction(ModerationSubmissionActionType.Reject)
}
</script>
