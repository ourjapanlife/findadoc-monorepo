import { readonly } from 'vue'

export enum ModerationSubmissionActionType {
    Update = 'UPDATE',
    UpdateAndExit = 'UPDATE_AND_EXIT',
    Approve = 'APPROVE',
    Reject = 'REJECT'
}

type ModerationSubmissionAction = {
    id: number
    type: ModerationSubmissionActionType
}

export function useModerationSubmissionActions() {
    const lastAction = useState<ModerationSubmissionAction | null>(
        'moderation-submission-last-action',
        () => null
    )
    const actionSequence = useState<number>(
        'moderation-submission-action-sequence',
        () => 0
    )

    // The action whose request is in flight. The topbar disables its buttons and spins this one.
    const pendingAction = useState<ModerationSubmissionActionType | null>(
        'moderation-submission-pending-action',
        () => null
    )

    /** Runs the request for a topbar action. A second action while one runs is ignored. */
    const runModerationSubmissionAction = async (
        type: ModerationSubmissionActionType,
        action: () => Promise<unknown>
    ): Promise<void> => {
        if (pendingAction.value !== null) {
            return
        }
        pendingAction.value = type
        try {
            await action()
        } finally {
            pendingAction.value = null
        }
    }

    const emitModerationSubmissionAction = (type: ModerationSubmissionActionType) => {
        if (pendingAction.value !== null) {
            return
        }
        actionSequence.value += 1
        lastAction.value = {
            id: actionSequence.value,
            type
        }
    }

    return {
        moderationSubmissionAction: readonly(lastAction),
        moderationSubmissionPendingAction: readonly(pendingAction),
        emitModerationSubmissionAction,
        runModerationSubmissionAction
    }
}
