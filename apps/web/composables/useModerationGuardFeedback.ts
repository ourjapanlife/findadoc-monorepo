import type { AppToast } from '~/composables/useAppToast'
import { translatedFormError } from '~/utils/formErrorMessage'

/** Toasts the translated sentence and returns true when the action should stop. */
export function guardWithErrorToast(
    shouldBlock: boolean,
    toast: AppToast,
    t: (translatableString: string) => string | undefined,
    translationKey: string
): boolean {
    if (!shouldBlock) {
        return false
    }

    toast.error(translatedFormError(t, translationKey))
    return true
}

/** Like guardWithErrorToast, and runs onBlocked after the toast when the action stops. */
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
