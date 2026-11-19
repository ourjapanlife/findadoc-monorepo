type ConfirmationMode = 'create' | 'update'

interface ConfirmationConfig {
    message?: string
    title?: string
    onCancel?: () => void
    textConfirm?: string
    textCancel?: string
    mode?: ConfirmationMode
    destructive?: boolean
}

type ConfirmationConfigInput = string | ConfirmationConfig

const parseConfirmationConfig = (input: ConfirmationConfigInput): ConfirmationConfig =>
    typeof input === 'string' ? { message: input } : input

interface ConfirmationData {
    id: symbol
    message?: string
    title?: string
    textConfirm?: string
    textCancel?: string
    mode?: ConfirmationMode
    destructive?: boolean
    onConfirm: () => void | Promise<void>
    onCancel?: () => void
}

export default defineNuxtPlugin(() => {
    const confirmation = ref<ConfirmationData>()
    // True while onConfirm's promise runs. The dialog stays open with a spinner, and a second click does nothing.
    const pending = ref(false)

    const withConfirmation = (
        onConfirm: () => void | Promise<void>,
        input: ConfirmationConfigInput
    ) => {
        const config = parseConfirmationConfig(input)
        const id = Symbol('confirmation')

        confirmation.value = {
            id,
            title: config.title,
            message: config.message,
            textCancel: config.textCancel,
            textConfirm: config.textConfirm,
            mode: config.mode,
            destructive: config.destructive,
            onCancel: config.onCancel,
            onConfirm
        }

        return id
    }

    const clearIfCurrent = (id: symbol) => {
        if (confirmation.value?.id === id) confirmation.value = undefined
    }

    const confirmAction = async () => {
        const current = confirmation.value
        if (!current || pending.value) return

        pending.value = true
        try {
            await current.onConfirm()
        } finally {
            pending.value = false
            clearIfCurrent(current.id)
        }
    }

    const cancelAction = () => {
        const current = confirmation.value
        // The request has already gone out: cancelling now would hide it, not stop it.
        if (!current || pending.value) return

        current.onCancel?.()
        clearIfCurrent(current.id)
    }

    return {
        provide: {
            confirmationDialog: {
                confirmation,
                pending,
                confirmAction,
                cancelAction
            },
            withConfirmation
        }
    }
})
