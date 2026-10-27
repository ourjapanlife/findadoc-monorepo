import type { AppToast } from '~/composables/useAppToast'
import type { ServerError } from '~/typedefs/serverResponse'
import {
    fieldLabelKeyForServerField,
    GENERIC_FORM_ERROR_KEY,
    sentenceKeyForServerCode,
    translatedFormError,
    translationOrUndefined
} from '~/utils/formErrorMessage'

type Translate = (translatableString: string) => string | undefined
type HasTranslation = (key: string) => boolean

/**
 * One toast for every problem in the response. A missing translation falls back
 * to the generic sentence, so the screen never shows a raw key.
 */
export function handleServerErrorMessaging(
    serverErrors: ServerError[],
    toast: AppToast,
    t: Translate,
    te?: HasTranslation
) {
    if (serverErrors.length === 0) {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        return
    }

    const lines: string[] = []
    const shown = new Set<string>()
    for (const error of serverErrors) {
        const key = sentenceKeyForServerCode(error.code)
        const sentence = te !== undefined && !te(key)
            ? translatedFormError(t, GENERIC_FORM_ERROR_KEY)
            : translatedFormError(t, key)
        const labelKey = fieldLabelKeyForServerField(error.field)
        const title = labelKey === undefined ? undefined : translationOrUndefined(t, labelKey)
        const line = title === undefined ? sentence : `${title}: ${sentence}`
        if (shown.has(line)) continue
        shown.add(line)
        lines.push(line)
    }

    toast.error(lines.join(' '))
}
