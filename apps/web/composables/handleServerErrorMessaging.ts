import type { AppToast } from '~/composables/useAppToast'
import type { ServerError } from '~/typedefs/serverResponse'
import {
    GENERIC_FORM_ERROR_KEY,
    sentenceKeyForServerCode,
    translatedFormError
} from '~/utils/formErrorMessage'

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
        const translated = t(key)
        const missingSentence = !translated || translated === key
        if (missingSentence) {
            console.error(error.code)
            console.info(t('serverErrorMessages.errorCodeMessagingNeeded'))
        }
        if (shown.has(key)) continue
        shown.add(key)
        toast.error(translatedFormError(t, key))
    }
}
