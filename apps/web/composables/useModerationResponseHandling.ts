import type { AppToast } from '~/composables/useAppToast'
import { handleServerErrorMessaging } from '~/composables/handleServerErrorMessaging'
import type { ServerError } from '~/typedefs/serverResponse'
import { GENERIC_FORM_ERROR_KEY, translatedFormError } from '~/utils/formErrorMessage'
import { FacilityFieldError, facilityFieldErrorText } from '~/utils/facilitiesUtils'
import { hasServerErrors } from '~/utils/moderationUtils'

type Translate = (translatableString: string) => string | undefined
type HasTranslation = (key: string) => boolean

export function handleModerationResponseErrors(
    response: { errors?: ServerError[], hasErrors?: boolean } | undefined,
    toast: AppToast,
    t: Translate,
    te?: HasTranslation
): boolean {
    if (response === undefined || !hasServerErrors(response)) {
        return false
    }

    handleServerErrorMessaging(response.errors ?? [], toast, t, te)
    return true
}

/** A thrown validation error names its fields. Anything else is the generic failure. */
export function toastUnexpectedModerationError(
    error: unknown,
    toast: AppToast,
    t: Translate
) {
    console.error(error)
    if (error instanceof FacilityFieldError) {
        toast.error(facilityFieldErrorText(t, error.messageKeys))
        return
    }
    toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
}
