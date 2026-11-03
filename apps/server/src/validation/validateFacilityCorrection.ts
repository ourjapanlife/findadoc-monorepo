import * as gqlTypes from '@findadoc/graphql'
import { ErrorCode, type Error as ValidationError, type Result } from '../result.js'
import { hasScriptTags, isValidWebsite } from '../../utils/stringUtils.js'
import { isStorablePhone } from './validatePhone.js'
import { UUID_REGEX, validateAddressInput, validateSupportedLanguages } from './validateFacility.js'
import {
    CORRECTION_FIELD_REASON,
    CORRECTION_FIELDS,
    CORRECTION_NOTES_MAX,
    isCorrectionReporterRelation,
    isFacilityCorrectionReason
} from '../corrections/facilityCorrection.js'

const WEBSITE_MAX = 512
const LISTING_URL_MAX = 512
const PAYMENT_OPTIONS_MAX = Object.keys(gqlTypes.PaymentType).length
const PAYMENT_BRANDS_MAX = 16
const PAYMENT_BRAND_MAX = 64

// The apex or www. A clinic subdomain is a clinic site, not a directory listing.
const LISTING_HOSTS: ReadonlySet<string> = new Set(['findadoc.jp', 'www.findadoc.jp'])

function invalid(field: string, errorCode: ErrorCode): ValidationError {
    return { field, errorCode, httpStatus: 400 }
}

function httpsUrl(value: string): URL | null {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? url : null
    } catch {
        return null
    }
}

function reasonErrors(reasons: readonly unknown[]): ValidationError[] {
    if (reasons.length === 0) {
        return [invalid('reasons', ErrorCode.REQUIRED)]
    }
    if (reasons.some(reason => !isFacilityCorrectionReason(reason)) || new Set(reasons).size !== reasons.length) {
        return [invalid('reasons', ErrorCode.INVALID_INPUT)]
    }
    return []
}

/** A changed field is refused unless its reason was picked, so one reason cannot carry another field. */
function fieldReasonErrors(input: gqlTypes.FacilityCorrectionInput): ValidationError[] {
    const reasons = new Set<string>(input.reasons)

    return CORRECTION_FIELDS
        .filter(field => input[field] !== undefined && input[field] !== null)
        .filter(field => !reasons.has(CORRECTION_FIELD_REASON[field]))
        .map(field => invalid(field, ErrorCode.CORRECTION_FIELD_WITHOUT_REASON))
}

function addressErrors(address: gqlTypes.PhysicalAddressInput): ValidationError[] {
    const lengthErrors = validateAddressInput(address).errors ?? []
    const scriptErrors = Object.entries(address)
        .filter(([, value]) => typeof value === 'string' && hasScriptTags(value))
        .map(([key]) => invalid(`address.${key}`, ErrorCode.INVALID_INPUT))

    return [...lengthErrors.map(error => ({ ...error, field: `address.${error.field}` })), ...scriptErrors]
}

function contactErrors(input: gqlTypes.FacilityCorrectionInput): ValidationError[] {
    const errors: ValidationError[] = []
    const phone = input.phone?.trim()
    const website = input.website?.trim()

    if (phone !== undefined && !isStorablePhone(phone)) {
        errors.push(invalid('phone', ErrorCode.INVALID_PHONE_NUMBER))
    }
    if (website !== undefined && website !== ''
        && (website.length > WEBSITE_MAX || httpsUrl(website) === null || !isValidWebsite(website))) {
        errors.push(invalid('website', ErrorCode.INVALID_WEBSITE))
    }
    return errors
}

function paymentErrors(options: gqlTypes.PaymentOptionsInput[]): ValidationError[] {
    if (options.length > PAYMENT_OPTIONS_MAX) {
        return [invalid('paymentOptions', ErrorCode.MAX_LIMIT)]
    }
    if (new Set(options.map(option => option.paymentType)).size !== options.length) {
        return [invalid('paymentOptions', ErrorCode.INVALID_INPUT)]
    }

    const errors: ValidationError[] = []

    options.forEach((option, index) => {
        const brands = option.paymentBrands ?? []
        if (brands.length > PAYMENT_BRANDS_MAX) {
            errors.push(invalid(`paymentOptions[${index}].paymentBrands`, ErrorCode.MAX_LIMIT))
        }
        if (brands.some(brand => brand.length > PAYMENT_BRAND_MAX)) {
            errors.push(invalid(`paymentOptions[${index}].paymentBrands`, ErrorCode.INVALID_LENGTH_TOO_LONG))
        }
        if (brands.some(brand => hasScriptTags(brand))) {
            errors.push(invalid(`paymentOptions[${index}].paymentBrands`, ErrorCode.INVALID_INPUT))
        }
    })
    return errors
}

function listingUrlErrors(value: string): ValidationError[] {
    const url = value.length > LISTING_URL_MAX ? null : httpsUrl(value.trim())

    if (url === null || !LISTING_HOSTS.has(url.hostname)) {
        return [invalid('duplicateListingUrl', ErrorCode.INVALID_LISTING_URL)]
    }
    return []
}

function notesErrors(notes: string): ValidationError[] {
    if (notes.length > CORRECTION_NOTES_MAX) {
        return [invalid('notes', ErrorCode.INVALID_LENGTH_TOO_LONG)]
    }
    if (hasScriptTags(notes)) {
        return [invalid('notes', ErrorCode.INVALID_INPUT)]
    }
    return []
}

function languageErrors(languages: gqlTypes.Locale[]): ValidationError[] {
    const result: Result<unknown> = { data: undefined, hasErrors: false, errors: [] }
    validateSupportedLanguages(languages, result)
    return result.errors ?? []
}

/**
 * Checks a visitor's correction (#22). Whether the facility is published is checked
 * against the database by the service.
 */
export function validateFacilityCorrectionInput(input: gqlTypes.FacilityCorrectionInput): Result<unknown> {
    const errors: ValidationError[] = []

    if (!UUID_REGEX.test(input.facilityId)) {
        errors.push(invalid('facilityId', ErrorCode.INVALID_ID))
    }

    errors.push(...reasonErrors(input.reasons))
    errors.push(...fieldReasonErrors(input))
    errors.push(...contactErrors(input))

    if (input.address !== undefined && input.address !== null) {
        errors.push(...addressErrors(input.address))
    }
    if (input.supportedLanguages !== undefined && input.supportedLanguages !== null) {
        errors.push(...languageErrors(input.supportedLanguages))
    }
    if (input.paymentOptions !== undefined && input.paymentOptions !== null) {
        errors.push(...paymentErrors(input.paymentOptions))
    }
    if (input.duplicateListingUrl !== undefined && input.duplicateListingUrl !== null) {
        errors.push(...listingUrlErrors(input.duplicateListingUrl))
    }
    if (input.notes !== undefined && input.notes !== null) {
        errors.push(...notesErrors(input.notes))
    }
    if (input.reporterRelation !== undefined && input.reporterRelation !== null
        && !isCorrectionReporterRelation(input.reporterRelation)) {
        errors.push(invalid('reporterRelation', ErrorCode.INVALID_INPUT))
    }

    return { data: undefined, hasErrors: errors.length > 0, errors }
}
