import type { AppToast } from '~/composables/useAppToast'
import { handleServerErrorMessaging } from '~/composables/handleServerErrorMessaging'
import type { ServerError } from '~/typedefs/serverResponse'
import { hasServerErrors } from '~/utils/moderationUtils'

export function handleModerationResponseErrors(
    response: { errors?: ServerError[] } | undefined,
    toast: AppToast,
    t: (translatableString: string) => string | undefined
): boolean {
    if (!hasServerErrors(response)) {
        return false
    }

    handleServerErrorMessaging(response.errors, toast, t)
    return true
}
