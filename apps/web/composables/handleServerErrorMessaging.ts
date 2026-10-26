import type { AppToast } from '~/composables/useAppToast'
import type { ServerError } from '~/typedefs/serverResponse'
import {
    fieldLabelKeyForServerField,
    GENERIC_FORM_ERROR_KEY,
    sentenceKeyForServerCode,
    translatedFormError,
    translationOrUndefined
} from '~/utils/formErrorMessage'

/**
 * Toasts one translated sentence per distinct problem. A field the form labels
 * becomes the toast title, so two refused fields with the same rule show twice.
 */
export function handleServerErrorMessaging(
    serverErrors: ServerError[],
    toast: AppToast,
    t: (translatableString: string) => string | undefined
) {
    if (serverErrors.length === 0) {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        return
    }

    const shown = new Set<string>()
    for (const error of serverErrors) {
        const key = sentenceKeyForServerCode(error.code)
        if (translationOrUndefined(t, key) === undefined) {
            console.error(`No translated sentence for server code ${error.code}`)
        }

        const labelKey = fieldLabelKeyForServerField(error.field)
        const title = labelKey === undefined ? undefined : translationOrUndefined(t, labelKey)
        const toastId = `${title ?? ''}|${key}`
        if (shown.has(toastId)) continue
        shown.add(toastId)

        toast.error(translatedFormError(t, key), title === undefined ? undefined : { title })
    }
}
