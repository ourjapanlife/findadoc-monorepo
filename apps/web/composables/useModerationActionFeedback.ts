import type { AppToast, ToastSentenceOptions } from '~/composables/useAppToast'

export function returnWithSuccessToast<T>(
    response: T,
    toast: AppToast,
    t: (translatableString: string) => string | undefined,
    translationKey: string,
    options?: ToastSentenceOptions
): T {
    const msg = t(translationKey) ?? translationKey ?? ''
    toast.success(msg, options)
    return response
}
