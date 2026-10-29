import { appToastManager, TOAST_DURATION_MS } from '~/composables/useAppToast'
import { useTranslation } from '~/composables/useTranslation'
import { translatedFormError } from '~/utils/formErrorMessage'

/** A list load failed. The sentence is translated, and a missing key stays off the screen. */
export function toastModerationLoadError(messageKey: string) {
    appToastManager.add({
        title: useTranslation('toast.dangerTitle'),
        description: translatedFormError(useTranslation, messageKey),
        status: 'danger',
        type: 'foreground',
        duration: TOAST_DURATION_MS
    })
}
