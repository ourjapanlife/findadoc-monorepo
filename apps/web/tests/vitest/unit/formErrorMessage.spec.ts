import { describe, expect, it, vi } from 'vitest'
import { handleServerErrorMessaging } from '~/composables/handleServerErrorMessaging'
import { ErrorCode, type ServerError } from '~/typedefs/serverResponse'
import {
    formErrorKey,
    GENERIC_FORM_ERROR_KEY,
    sentenceKeyForServerCode,
    serverErrorsFromGraphQL,
    translatedFormError
} from '~/utils/formErrorMessage'

function catalog(messages: Record<string, string>) {
    return (key: string) => messages[key] ?? key
}

const generic = 'There was an error submitting your form, please try again'

describe('translatedFormError', () => {
    it('uses one sentence for a server code and the matching field check', () => {
        const t = catalog({
            [formErrorKey.invalidEmail]: 'Enter a valid email address.',
            [GENERIC_FORM_ERROR_KEY]: generic
        })

        expect(translatedFormError(t, sentenceKeyForServerCode(ErrorCode.INVALID_EMAIL)))
            .toBe('Enter a valid email address.')
        expect(translatedFormError(t, formErrorKey.invalidEmail)).toBe('Enter a valid email address.')
    })

    it('uses the generic sentence when the key is missing', () => {
        const t = catalog({ [GENERIC_FORM_ERROR_KEY]: generic })

        expect(translatedFormError(t, 'serverErrorMessages.INVALID_SUBMISSION_APPROVAL')).toBe(generic)
    })
})

describe('serverErrorsFromGraphQL', () => {
    it('reads the refused rule inside a validation error', () => {
        const errors = serverErrorsFromGraphQL([{
            message: 'Validation Failed',
            extensions: {
                code: 'BAD_USER_INPUT',
                errors: [{ field: 'status', errorCode: 'SUBMISSION_ALREADY_APPROVED' }]
            }
        }])

        expect(errors.map(error => error.code)).toEqual(['SUBMISSION_ALREADY_APPROVED'])
    })
})

describe('handleServerErrorMessaging', () => {
    it('toasts each distinct sentence and never the key', () => {
        const toast = { error: vi.fn() }
        const t = catalog({
            [formErrorKey.invalidEmail]: 'Enter a valid email address.',
            [formErrorKey.submissionAlreadyApproved]: 'This submission has already been approved.',
            [GENERIC_FORM_ERROR_KEY]: generic,
            'serverErrorMessages.errorCodeMessagingNeeded': 'Add a sentence.'
        })
        const errors: ServerError[] = [
            { message: 'Validation Failed', fieldWithError: undefined, code: ErrorCode.INVALID_EMAIL },
            { message: 'Validation Failed', fieldWithError: undefined, code: ErrorCode.SUBMISSION_ALREADY_APPROVED },
            { message: 'Validation Failed', fieldWithError: undefined, code: ErrorCode.INVALID_EMAIL }
        ]

        handleServerErrorMessaging(errors, toast as never, t)

        expect(toast.error).toHaveBeenCalledTimes(2)
        expect(toast.error).toHaveBeenCalledWith('Enter a valid email address.')
        expect(toast.error).toHaveBeenCalledWith('This submission has already been approved.')
    })

    it('falls back when a code has no sentence', () => {
        const toast = { error: vi.fn() }
        const t = catalog({ [GENERIC_FORM_ERROR_KEY]: generic })

        handleServerErrorMessaging(
            [{
                message: 'nope',
                fieldWithError: undefined,
                code: ErrorCode.ORDERBY_OPTION_INVALID
            }],
            toast as never,
            t
        )

        expect(toast.error).toHaveBeenCalledTimes(1)
        expect(toast.error).toHaveBeenCalledWith(generic)
    })
})
