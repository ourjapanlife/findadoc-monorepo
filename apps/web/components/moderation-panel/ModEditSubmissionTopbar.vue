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
            <button
                type="button"
                :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                data-testid="submission-topNav-update"
                @click="requestUpdate"
            >
                {{ t('modEditSubmissionTopNav.update') }}
            </button>
            <button
                type="button"
                :class="[buttonBaseClass, actionButtonClass, buttonOutlineClass, buttonPaddingClass]"
                data-testid="submission-topNav-updateAndExit"
                @click="requestUpdateAndExit"
            >
                {{ t('modEditSubmissionTopNav.updateAndExit') }}
            </button>
            <button
                data-testid="mod-edit-submission-reject-button"
                type="button"
                :class="[buttonBaseClass, actionButtonClass, buttonDangerClass, buttonPaddingClass]"
                @click="requestRejectConfirmation"
            >
                {{ t('modEditSubmissionTopNav.reject') }}
            </button>
            <button
                type="button"
                :class="[buttonBaseClass, actionButtonClass, buttonPrimaryClass, buttonPaddingClass]"
                @click="requestApproveConfirmation"
            >
                {{ t('modEditSubmissionTopNav.approve') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ModerationSubmissionActionType, useModerationSubmissionActions } from '~/composables/useModerationSubmissionActions'
import { leaveToModerationDashboard } from '~/utils/moderationUtils'

const { t } = useI18n()
const router = useRouter()
const moderationScreenStore = useModerationScreenStore()
const modalStore = useModalStore()

const moderationSubmissionUnsavedStore = useModerationSubmissionUnsavedStore()
const { emitModerationSubmissionAction } = useModerationSubmissionActions()

const goToDashboard = () => {
    moderationSubmissionUnsavedStore.runLeaveOr(() =>
        leaveToModerationDashboard(router, moderationScreenStore, modalStore, 'submissions'))
}

const buttonBaseClass = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-full border-2'
  + ' break-words text-center text-sm font-bold leading-tight landscape:text-base'
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
