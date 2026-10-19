import type { AppToast } from '~/composables/useAppToast'
import type { ServerError } from '~/typedefs/serverResponse'

export function handleServerErrorMessaging(
    serverErrors: ServerError[], toast: AppToast,
    t: (translatableString: string) => string | undefined
) {
    if (serverErrors.length === 0) {
        toast.error(t('serverErrorMessages.genericErrorMessage') ?? 'An error occurred')
        return
    }
    serverErrors.forEach(error => {
        const specific = t(`serverErrorMessages.${error.code}`)
        if (specific) {
            toast.error(specific)
            console.error(error.code)
            return
        }
        toast.error(t('serverErrorMessages.genericErrorMessage') ?? 'An error occurred')
        console.error((t('serverErrorMessages.genericErrorMessage')))
        console.info(t('serverErrorMessages.errorCodeMessagingNeeded'))
    })
}
