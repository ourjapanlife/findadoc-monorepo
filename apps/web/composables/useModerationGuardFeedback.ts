import type { AppToast } from '~/composables/useAppToast'

export function guardWithErrorToast(
    shouldBlock: boolean,
    toast: AppToast,
    t: (translatableString: string) => string | undefined,
    translationKey: string
): boolean {
    if (!shouldBlock) {
        return false
    }

    const message = t(translationKey) ?? translationKey ?? ''
    toast.error(message)
    return true
}

export async function guardWithErrorToastAndEffect(
    shouldBlock: boolean,
    toast: AppToast,
    t: (translatableString: string) => string | undefined,
    translationKey: string,
    onBlocked: () => void | Promise<void>
): Promise<boolean> {
    if (!guardWithErrorToast(shouldBlock, toast, t, translationKey)) {
        return false
    }

    await onBlocked()
    return true
}
