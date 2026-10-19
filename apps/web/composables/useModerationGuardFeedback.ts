import type { AppToast } from '~/composables/useAppToast'
import { translatedFormError } from '~/utils/formErrorMessage'

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
