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

const generic = 'That did not work. Please try again.'

describe('sentenceKeyForServerCode', () => {
    it('does not return an inherited property for an unknown code', () => {
        expect(sentenceKeyForServerCode('constructor')).toBe(GENERIC_FORM_ERROR_KEY)
        expect(sentenceKeyForServerCode('toString')).toBe(GENERIC_FORM_ERROR_KEY)
        expect(sentenceKeyForServerCode(undefined)).toBe(GENERIC_FORM_ERROR_KEY)
    })

    it('does not tell a signed-in user without the scope to sign in', () => {
        expect(sentenceKeyForServerCode(ErrorCode.UNAUTHORIZED)).toBe('serverErrorMessages.notAllowed')
    })
})

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
    it('keeps the code and field of each refused rule inside a validation error', () => {
        const errors = serverErrorsFromGraphQL([{
            message: 'Validation Failed',
            extensions: {
                code: 'BAD_USER_INPUT',
                errors: [
                    { field: 'nameEn', errorCode: 'REQUIRED' },
                    { field: 'nameJa', errorCode: 'REQUIRED' }
                ]
            }
        }])

        expect(errors.map(({ code, field }) => ({ code, field }))).toEqual([
            { code: 'REQUIRED', field: 'nameEn' },
            { code: 'REQUIRED', field: 'nameJa' }
        ])
    })

    it('uses the wrapper code when there is no nested rule', () => {
        const errors = serverErrorsFromGraphQL([{
            message: 'User is not authorized',
            extensions: { code: 'UNAUTHORIZED' }
        }])

        expect(errors).toEqual([{ message: 'User is not authorized', code: 'UNAUTHORIZED', field: undefined }])
    })
})

describe('handleServerErrorMessaging', () => {
    it('toasts each distinct sentence and never the key', () => {
        const toast = { error: vi.fn() }
        const t = catalog({
            [formErrorKey.invalidEmail]: 'Enter a valid email address.',
            [formErrorKey.submissionAlreadyApproved]: 'This submission has already been approved.',
            [GENERIC_FORM_ERROR_KEY]: generic
        })
        const errors: ServerError[] = [
            { message: 'Validation Failed', field: undefined, code: ErrorCode.INVALID_EMAIL },
            { message: 'Validation Failed', field: undefined, code: ErrorCode.SUBMISSION_ALREADY_APPROVED },
            { message: 'Validation Failed', field: undefined, code: ErrorCode.INVALID_EMAIL }
        ]

        handleServerErrorMessaging(errors, toast as never, t)

        expect(toast.error).toHaveBeenCalledTimes(2)
        expect(toast.error).toHaveBeenCalledWith('Enter a valid email address.', undefined)
        expect(toast.error).toHaveBeenCalledWith('This submission has already been approved.', undefined)
    })

    it('names each refused field that the form labels', () => {
        const toast = { error: vi.fn() }
        const t = catalog({
            'serverErrorMessages.requiredFieldEmpty': 'A required field is empty.',
            'modFacilitySection.labelFacilityNameEn': 'English Name Facility',
            'modFacilitySection.labelFacilityNameJa': 'Japanese Name Facility',
            [GENERIC_FORM_ERROR_KEY]: generic
        })

        handleServerErrorMessaging(
            [
                { message: 'Validation Failed', field: 'nameEn', code: ErrorCode.REQUIRED },
                { message: 'Validation Failed', field: 'nameJa', code: ErrorCode.REQUIRED }
            ],
            toast as never,
            t
        )

        expect(toast.error).toHaveBeenCalledTimes(2)
        expect(toast.error).toHaveBeenCalledWith('A required field is empty.', { title: 'English Name Facility' })
        expect(toast.error).toHaveBeenCalledWith('A required field is empty.', { title: 'Japanese Name Facility' })
    })

    it('falls back when a code has no sentence', () => {
        const toast = { error: vi.fn() }
        const t = catalog({ [GENERIC_FORM_ERROR_KEY]: generic })

        handleServerErrorMessaging(
            [{ message: 'nope', field: undefined, code: ErrorCode.ORDERBY_OPTION_INVALID }],
            toast as never,
            t
        )

        expect(toast.error).toHaveBeenCalledTimes(1)
        expect(toast.error).toHaveBeenCalledWith(generic, undefined)
    })
})
