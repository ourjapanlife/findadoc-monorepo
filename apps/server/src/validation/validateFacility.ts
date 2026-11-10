import * as gqlTypes from '@findadoc/graphql'
import { ErrorCode, Result } from '../result.js'
import { hasSpecialCharacters, isValidEmail, isValidWebsite } from '../../utils/stringUtils.js'
import { isStorablePhone } from './validatePhone.js'
import { resolvePrefectureKey } from '../../utils/japanesePrefectures.js'
import { LIST_QUERY_MAX } from '../search/listQuery.js'
import { isPublishedLocale } from '../languages/publishedLocales.js'
import { paymentOptionsProblem } from '@findadoc/utils'

/** A Places id token, as Google writes it. 256 characters is far above any real id. */
const GOOGLE_PLACE_ID = /^[A-Za-z0-9_-]{8,256}$/

/** The trimmed id when it looks like a Places id, else null. */
export function googlePlaceIdOrNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim()
    return GOOGLE_PLACE_ID.test(trimmed) ? trimmed : null
}

/** An empty value means "none"; anything else has to look like a Places id. */
export function validateGooglePlaceId(
    value: string | null | undefined,
    validationResults: Result<unknown>,
    field = 'googlePlaceId'
) {
    const trimmed = (value ?? '').trim()
    if (trimmed && !googlePlaceIdOrNull(trimmed)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field,
            errorCode: ErrorCode.INVALID_INPUT,
            httpStatus: 400
        })
    }
}

// Used for v4 uuid
export const UUID_REGEX =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Validates the ID input for database queries, checking for length and special characters.
 */
export function validateIdInput(id: string): Result<unknown> {
    const validationResults: Result<unknown> = {
        data: undefined,
        hasErrors: false,
        errors: []
    }

    if (UUID_REGEX.test(id)) {
        return validationResults
    }
    
    if (id && (hasSpecialCharacters(id) || id.length > 4096)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'id',
            errorCode: ErrorCode.INVALID_ID,
            httpStatus: 400
        })
    }

    return validationResults
}

/**
 * Validates search input to prevent overly long text filters or extreme limit values.
 */
export function validateFacilitiesSearchInput(searchInput: gqlTypes.FacilitySearchFilters): Result<unknown> {
    const validationResults: Result<unknown> = {
        data: [],
        hasErrors: false,
        errors: []
    }

    if (searchInput.nameEn && searchInput.nameEn.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameEn',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (searchInput.nameJa && searchInput.nameJa.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameJa',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (searchInput.query && searchInput.query.length > LIST_QUERY_MAX) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'query',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (searchInput.prefecture && !resolvePrefectureKey(searchInput.prefecture)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'prefecture',
            errorCode: ErrorCode.INVALID_INPUT,
            httpStatus: 400
        })
    }

    if (searchInput.limit && searchInput.limit > 1000) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'limit',
            errorCode: ErrorCode.MAX_LIMIT,
            httpStatus: 400
        })
    }

    if (searchInput.limit && searchInput.limit < 0) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'limit',
            errorCode: ErrorCode.MIN_LIMIT,
            httpStatus: 400
        })
    }

    return validationResults
}

const SUPPORTED_LANGUAGE_MAX = 16

/**
 * Facility languages are optional. A value must be on the published allowlist.
 * An empty list is a facility that does not advertise a language of its own.
 */
export function validateSupportedLanguages(
    languages: gqlTypes.Locale[] | null | undefined,
    validationResults: Result<unknown>
): void {
    if (!languages) {
        return
    }

    if (languages.length > SUPPORTED_LANGUAGE_MAX) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'supportedLanguages',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
        return
    }

    if (languages.some(language => !isPublishedLocale(language))) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'supportedLanguages',
            errorCode: ErrorCode.INVALID_INPUT,
            httpStatus: 400
        })
    }
}

/**
 * Payment is optional (#20). Each type appears once, and each brand is on the controlled list
 * for its type. Null or an empty list clears the answer back to unknown.
 */
export function validatePaymentOptions(
    options: readonly gqlTypes.PaymentOptionsInput[] | null | undefined,
    validationResults: Result<unknown>,
    field = 'paymentOptions'
): void {
    if (!options) {
        return
    }

    const problem = paymentOptionsProblem(options)

    if (problem) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field,
            errorCode: problem === 'too_many' ? ErrorCode.INVALID_LENGTH_TOO_LONG : ErrorCode.INVALID_INPUT,
            httpStatus: 400
        })
    }
}

export interface UpdateFacilityValidationOptions {
    /**
     * The caller checks a phone that does not parse against the stored value with
     * `isAcceptedUpdatePhone`, on the row it has locked. A stored phone read before the lock can be
     * stale, so this validator does not judge an unparseable phone in that case.
     */
    legacyPhoneCheckedUnderLock?: boolean
}

const JAPANESE_INSURANCE_SOURCE_MAX = 500

/**
 * Japanese public insurance on a facility (#18). The source is an optional note:
 * a link, or a call to the clinic. Unknown is null with no source.
 */
export function validateJapaneseInsurance(
    input: { japaneseInsurance?: gqlTypes.JapaneseInsurance | null, japaneseInsuranceSource?: string | null },
    validationResults: Result<unknown>
): void {
    const valueSent = input.japaneseInsurance !== undefined
    const sourceSent = input.japaneseInsuranceSource !== undefined

    if (!valueSent && !sourceSent) {
        return
    }

    const source = input.japaneseInsuranceSource?.trim() ?? ''

    if (!input.japaneseInsurance) {
        if (source || !valueSent) {
            validationResults.hasErrors = true
            validationResults.errors?.push({
                field: 'japaneseInsurance',
                errorCode: ErrorCode.REQUIRED,
                httpStatus: 400
            })
        }
        return
    }

    if (source.length > JAPANESE_INSURANCE_SOURCE_MAX) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'japaneseInsuranceSource',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }
}

/**
 * Validates the input for updating a facility.
 */
export function validateUpdateFacilityInput(
    input: Partial<gqlTypes.UpdateFacilityInput>,
    options: UpdateFacilityValidationOptions = {}
): Result<unknown> {
    const validationResults: Result<unknown> = {
        data: undefined,
        hasErrors: false,
        errors: []
    }

    if (input.nameEn && input.nameEn.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameEn',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.nameJa && input.nameJa.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameJa',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.contact) {
        const legacyPhoneCheckedUnderLock = options.legacyPhoneCheckedUnderLock === true
        const contactValidationResults = validateContactInput(input.contact, legacyPhoneCheckedUnderLock)

        if (contactValidationResults.hasErrors) {
            validationResults.hasErrors = true
            validationResults.errors?.push(...contactValidationResults.errors as [])
        }
    }

    // Switching off online requires a real map pin and Maps URL in this update.
    if (input.online === false) {
        pushRequiredMapErrors(input, validationResults)
        if (!(input.contact?.googleMapsUrl ?? '').trim()) {
            validationResults.hasErrors = true
            validationResults.errors?.push({
                field: 'contact.googleMapsUrl',
                errorCode: ErrorCode.REQUIRED,
                httpStatus: 400
            })
        }
        if (!input.contact?.address) {
            validationResults.hasErrors = true
            validationResults.errors?.push({
                field: 'contact.address',
                errorCode: ErrorCode.REQUIRED,
                httpStatus: 400
            })
        }
    }

    validateSupportedLanguages(input.supportedLanguages, validationResults)
    validateGooglePlaceId(input.googlePlaceId, validationResults)
    validateJapaneseInsurance(input, validationResults)
    validatePaymentOptions(input.paymentOptions, validationResults)

    return validationResults
}

/**
 * Validates the input for creating a facility, ensuring required fields are present and valid.
 */
export function validateCreateFacilityInput(input: gqlTypes.CreateFacilityInput): Result<unknown> {
    const validationResults: Result<unknown> = {
        data: undefined,
        hasErrors: false,
        errors: []
    }

    if (!input.nameEn) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameEn',
            errorCode: ErrorCode.REQUIRED,
            httpStatus: 400
        })
    }

    if (input.nameEn && input.nameEn.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameEn',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (!input.nameJa) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameJa',
            errorCode: ErrorCode.REQUIRED,
            httpStatus: 400
        })
    }

    if (input.nameJa && input.nameJa.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'nameJa',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.contact) {
        const contactValidationResults = validateContactInput(input.contact)

        if (contactValidationResults.hasErrors) {
            validationResults.hasErrors = true
            validationResults.errors?.push(...contactValidationResults.errors as [])
        }
    }

    // Online is opt-in. Only when true may address, Maps URL, and map pin be omitted.
    if (input.online !== true) {
        if (!input.contact?.address) {
            validationResults.hasErrors = true
            validationResults.errors?.push({
                field: 'contact.address',
                errorCode: ErrorCode.REQUIRED,
                httpStatus: 400
            })
        }
        if (!(input.contact?.googleMapsUrl ?? '').trim()) {
            validationResults.hasErrors = true
            validationResults.errors?.push({
                field: 'contact.googleMapsUrl',
                errorCode: ErrorCode.REQUIRED,
                httpStatus: 400
            })
        }
        pushRequiredMapErrors(input, validationResults)
    }

    validateSupportedLanguages(input.supportedLanguages, validationResults)
    validateGooglePlaceId(input.googlePlaceId, validationResults)
    validateJapaneseInsurance(input, validationResults)
    validatePaymentOptions(input.paymentOptions, validationResults)

    return validationResults
}

/**
 * A normal facility needs a real map pin. Null/omitted or the old 0/0 sentinel are not enough.
 */
function pushRequiredMapErrors(
    input: {
        mapLatitude?: number | null
        mapLongitude?: number | null
    },
    validationResults: Result<unknown>
): void {
    if (!hasUsableMapPin(input.mapLatitude, input.mapLongitude)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'mapLatitude',
            errorCode: ErrorCode.REQUIRED,
            httpStatus: 400
        })
        validationResults.errors?.push({
            field: 'mapLongitude',
            errorCode: ErrorCode.REQUIRED,
            httpStatus: 400
        })
    }
}

export function hasUsableMapPin(
    latitude?: number | null,
    longitude?: number | null
): boolean {
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
        return false
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false
    }
    // 0/0 was the previous empty-pin sentinel and is not a Japan clinic location.
    if (latitude === 0 || longitude === 0) {
        return false
    }
    return true
}

export function validateContactInput(
    contactInput: gqlTypes.ContactInput | gqlTypes.Contact,
    legacyPhoneCheckedUnderLock = false
): Result<unknown> {
    const validationResults: Result<unknown> = {
        data: undefined,
        hasErrors: false,
        errors: []
    }

    if (!contactInput) {
        return validationResults
    }

    if (contactInput.email && (!isValidEmail(contactInput.email) || contactInput.email.length > 128)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'email',
            errorCode: ErrorCode.INVALID_EMAIL,
            httpStatus: 400
        })
    }

    if (contactInput.phone && !legacyPhoneCheckedUnderLock && !isStorablePhone(contactInput.phone)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'phone',
            errorCode: ErrorCode.INVALID_PHONE_NUMBER,
            httpStatus: 400
        })
    }

    if (contactInput.website && !isValidWebsite(contactInput.website)) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'website',
            errorCode: ErrorCode.INVALID_WEBSITE,
            httpStatus: 400
        })
    }

    if (contactInput.address) {
        const addressValidationResults = validateAddressInput(contactInput.address)

        if (addressValidationResults.hasErrors) {
            validationResults.hasErrors = true
            validationResults.errors?.push(...addressValidationResults.errors as [])
        }
    }

    return validationResults
}

export function validateAddressInput(input: gqlTypes.PhysicalAddress): Result<unknown> {
    const validationResults: Result<unknown> = {
        data: undefined,
        hasErrors: false,
        errors: []
    }

    if (input.addressLine1En && input.addressLine1En.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'addressLine1En',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.addressLine2En && input.addressLine2En.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'addressLine2En',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.addressLine1Ja && input.addressLine1Ja.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'addressLine1Ja',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.addressLine2Ja && input.addressLine2Ja.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'addressLine2Ja',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.cityEn && input.cityEn.length > 64) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'cityEn',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.cityJa && input.cityJa.length > 64) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'cityJa',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.postalCode && input.postalCode.length > 18) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'postalCode',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.prefectureEn && input.prefectureEn.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'prefectureEn',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    if (input.prefectureJa && input.prefectureJa.length > 128) {
        validationResults.hasErrors = true
        validationResults.errors?.push({
            field: 'prefectureJa',
            errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG,
            httpStatus: 400
        })
    }

    return validationResults
}
