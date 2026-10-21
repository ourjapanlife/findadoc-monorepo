import type { ErrorCode, ServerError } from '~/typedefs/serverResponse'

/** Shown when a code has no sentence, or the sentence for that code is missing. */
export const GENERIC_FORM_ERROR_KEY = 'serverErrorMessages.genericErrorMessage'

const LAST_RESORT_SENTENCE = 'There was an error submitting your form, please try again'

/**
 * One sentence per problem. Several server codes share a sentence when they
 * mean the same thing for the person filling the form.
 */
const SENTENCE_BY_CODE: Record<string, string> = {
    SERVER_ERROR: 'serverErrorMessages.serverUnavailable',
    INTERNAL_SERVER_ERROR: 'serverErrorMessages.serverUnavailable',
    NOT_FOUND: 'serverErrorMessages.recordNotFound',
    INVALID_ID: 'serverErrorMessages.recordNotFound',
    REQUIRED: 'serverErrorMessages.requiredFieldEmpty',
    MISSING_INPUT: 'serverErrorMessages.requiredFieldEmpty',
    INVALID_EMAIL: 'serverErrorMessages.invalidEmail',
    INVALID_PHONE_NUMBER: 'serverErrorMessages.invalidPhone',
    INVALID_WEBSITE: 'serverErrorMessages.invalidWebsite',
    INVALID_INPUT: 'serverErrorMessages.invalidInformation',
    BAD_USER_INPUT: 'serverErrorMessages.invalidInformation',
    INVALID_SUBMISSION_APPROVAL: 'serverErrorMessages.submissionCannotBeApproved',
    SUBMISSION_ALREADY_APPROVED: 'serverErrorMessages.submissionAlreadyApproved',
    CREATEPROFFESIONAL_FACILITYIDS_REQUIRED: 'serverErrorMessages.clinicRequired',
    UPDATEPROFFESIONAL_FACILITYIDS_REQUIRED: 'serverErrorMessages.clinicRequired',
    CONTAINS_JAPANESE_CHARACTER: 'serverErrorMessages.japaneseInEnglishField',
    CONTAINS_LATIN_CHARACTER: 'serverErrorMessages.latinInJapaneseField',
    CONTAINS_INVALID_CHARACTER: 'serverErrorMessages.invalidCharacter',
    CONTAINS_DUPLICATE_LOCAL: 'serverErrorMessages.duplicateLanguage',
    INVALID_LANGUAGE_INPUT: 'serverErrorMessages.invalidLanguage',
    INVALID_LENGTH_NAME_TOO_LONG: 'serverErrorMessages.fieldTooLong',
    MAX_LIMIT: 'serverErrorMessages.fieldTooLong',
    MIN_LIMIT: 'serverErrorMessages.fieldTooShort',
    NEGATIVE_NUMBER: 'serverErrorMessages.negativeNumber',
    NO_UPDATES_FOUND: 'serverErrorMessages.nothingToSave',
    UNAUTHENTICATED: 'serverErrorMessages.signInRequired',
    UNAUTHORIZED: 'serverErrorMessages.signInRequired'
}

/** Client checks that match a rule the API also enforces, or that the API does not name. */
export const formErrorKey = {
    englishNameRequired: 'serverErrorMessages.englishNameRequired',
    facilityFieldsIncomplete: 'serverErrorMessages.facilityFieldsIncomplete',
    healthcareProfessionalFieldsIncomplete: 'serverErrorMessages.healthcareProfessionalFieldsIncomplete',
    submissionAlreadyApproved: 'serverErrorMessages.submissionAlreadyApproved',
    invalidEmail: 'serverErrorMessages.invalidEmail',
    invalidPhone: 'serverErrorMessages.invalidPhone',
    invalidWebsite: 'serverErrorMessages.invalidWebsite'
} as const

export function sentenceKeyForServerCode(code: string | undefined): string {
    if (!code) return GENERIC_FORM_ERROR_KEY
    return SENTENCE_BY_CODE[code] ?? GENERIC_FORM_ERROR_KEY
}

type Translate = (key: string) => string | undefined

/**
 * vue-i18n returns the key itself when the sentence is missing, and that string
 * is truthy. Treat that as missing and use the generic sentence.
 */
export function translatedFormError(t: Translate, key: string): string {
    const value = t(key)
    if (value && value !== key) return value

    if (key !== GENERIC_FORM_ERROR_KEY) {
        const generic = t(GENERIC_FORM_ERROR_KEY)
        if (generic && generic !== GENERIC_FORM_ERROR_KEY) return generic
    }

    return LAST_RESORT_SENTENCE
}

type GraphQLErrorLike = {
    message: string
    locations?: ServerError['fieldWithError']
    extensions?: { readonly [key: string]: unknown }
}

/**
 * Validation failures arrive as one GraphQL error whose code is BAD_USER_INPUT.
 * The rule the server refused is on extensions.errors[].errorCode.
 */
export function serverErrorsFromGraphQL(errors: readonly GraphQLErrorLike[] | undefined): ServerError[] {
    if (!errors) return []

    return errors.flatMap(errorResponse => {
        const nested = nestedErrorCodes(errorResponse.extensions?.errors)
        if (nested.length > 0) {
            return nested.map(code => ({
                message: errorResponse.message,
                fieldWithError: errorResponse.locations,
                code
            }))
        }

        const wrapper = errorResponse.extensions?.code
        const code = typeof wrapper === 'string' && wrapper.length > 0
            ? wrapper as ErrorCode
            : 'SERVER_ERROR' as ErrorCode

        return [{
            message: errorResponse.message,
            fieldWithError: errorResponse.locations,
            code
        }]
    })
}

function nestedErrorCodes(value: unknown): ErrorCode[] {
    if (!Array.isArray(value)) return []

    return value.flatMap(item => {
        if (!item || typeof item !== 'object' || !('errorCode' in item)) return []
        const code = item.errorCode
        if (typeof code !== 'string' || code.length === 0) return []
        return [code as ErrorCode]
    })
}
