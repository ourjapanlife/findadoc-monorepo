import type { ErrorCode, ServerError } from '~/typedefs/serverResponse'

/** Shown when a code has no sentence, or the sentence for that code is missing. */
export const GENERIC_FORM_ERROR_KEY = 'serverErrorMessages.genericErrorMessage'

const LAST_RESORT_SENTENCE = 'That did not work. Please try again.'

/**
 * One sentence per problem. Several server codes share a sentence when they
 * mean the same thing for the person filling the form.
 */
const SENTENCE_BY_CODE: Readonly<Record<string, string>> = {
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
    // withScope answers 403 both for a missing scope and for a request with no signed-in user.
    UNAUTHORIZED: 'serverErrorMessages.notAllowed',
    NETWORK: 'serverErrorMessages.network'
}

/**
 * The server names the input field on each validation error. These are the fields
 * the moderation forms already label, so the toast can say which one was refused.
 */
const FIELD_LABEL_BY_SERVER_FIELD: Readonly<Record<string, string>> = {
    nameEn: 'modFacilitySection.labelFacilityNameEn',
    'facility.nameEn': 'modFacilitySection.labelFacilityNameEn',
    nameJa: 'modFacilitySection.labelFacilityNameJa',
    'facility.nameJa': 'modFacilitySection.labelFacilityNameJa',
    phone: 'modFacilitySection.labelFacilityPhoneNumber',
    email: 'modFacilitySection.labelFacilityEmail',
    website: 'modFacilitySection.labelFacilityWebsite',
    postalCode: 'modFacilitySection.labelFacilityPostalCode',
    prefectureEn: 'modFacilitySection.labelFacilityPrefectureEn',
    prefectureJa: 'modFacilitySection.labelFacilityPrefectureJa',
    cityEn: 'modFacilitySection.labelFacilityCityEn',
    cityJa: 'modFacilitySection.labelFacilityCityJa',
    addressLine1En: 'modFacilitySection.labelFacilityAddressLine1En',
    addressLine2En: 'modFacilitySection.labelFacilityAddressLine2En',
    addressLine1Ja: 'modFacilitySection.labelFacilityAddressLine1Ja',
    addressLine2Ja: 'modFacilitySection.labelFacilityAddressLine2Ja',
    googleMapsUrl: 'modFacilitySection.labelFacilityGoogleMapsUrl',
    'contact.googleMapsUrl': 'modFacilitySection.labelFacilityGoogleMapsUrl',
    mapLatitude: 'modFacilitySection.labelFacilityMapLatitude',
    mapLongitude: 'modFacilitySection.labelFacilityMapLongitude'
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

/** The sentence key for a server code, or the generic sentence when the code has none. */
export function sentenceKeyForServerCode(code: string | undefined): string {
    if (code === undefined || !Object.hasOwn(SENTENCE_BY_CODE, code)) return GENERIC_FORM_ERROR_KEY
    return SENTENCE_BY_CODE[code]!
}

/** The label key for a server field the moderation forms show, or undefined. */
export function fieldLabelKeyForServerField(field: string | undefined): string | undefined {
    if (field === undefined || !Object.hasOwn(FIELD_LABEL_BY_SERVER_FIELD, field)) return undefined
    return FIELD_LABEL_BY_SERVER_FIELD[field]
}

type Translate = (key: string) => string | undefined

/** The translation for a key, or undefined when vue-i18n returns the key because the entry is missing. */
export function translationOrUndefined(t: Translate, key: string): string | undefined {
    const value = t(key)
    return value && value !== key ? value : undefined
}

/**
 * vue-i18n returns the key itself when the sentence is missing, and that string
 * is truthy. Treat that as missing and use the generic sentence.
 */
export function translatedFormError(t: Translate, key: string): string {
    return translationOrUndefined(t, key)
      ?? translationOrUndefined(t, GENERIC_FORM_ERROR_KEY)
      ?? LAST_RESORT_SENTENCE
}

type GraphQLErrorLike = {
    message: string
    extensions?: { readonly [key: string]: unknown }
}

type NestedError = { code: ErrorCode, field: string | undefined }

/**
 * Validation failures arrive as one GraphQL error whose code is BAD_USER_INPUT.
 * Each rule the server refused is on extensions.errors[], with its errorCode and field.
 */
export function serverErrorsFromGraphQL(errors: readonly GraphQLErrorLike[] | undefined): ServerError[] {
    if (!errors) return []

    return errors.flatMap(errorResponse => {
        const nested = nestedErrors(errorResponse.extensions?.errors)
        if (nested.length > 0) {
            return nested.map(({ code, field }) => ({ message: errorResponse.message, code, field }))
        }

        const wrapper = errorResponse.extensions?.code
        const code = typeof wrapper === 'string' && wrapper.length > 0
            ? wrapper as ErrorCode
            : 'SERVER_ERROR' as ErrorCode

        return [{ message: errorResponse.message, code, field: undefined }]
    })
}

function nestedErrors(value: unknown): NestedError[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((item: unknown) => {
        if (!item || typeof item !== 'object') return []
        const { errorCode, field } = item as { errorCode?: unknown, field?: unknown }
        if (typeof errorCode !== 'string' || errorCode.length === 0) return []
        return [{
            code: errorCode as ErrorCode,
            field: typeof field === 'string' && field.length > 0 ? field : undefined
        }]
    })
}
