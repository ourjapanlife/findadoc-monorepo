import type * as gqlTypes from '@findadoc/graphql'
import { fitsFieldLimit } from '@findadoc/utils'
import { ErrorCode, type Error as ValidationError, type Result } from '../result.js'
import { hasScriptTags, isValidWebsite } from '../../utils/stringUtils.js'
import { isStorablePhone } from './validatePhone.js'
import {
    UUID_REGEX,
    validateAddressInput,
    validatePaymentOptions,
    validateSupportedLanguages
} from './validateFacility.js'
import {
    CORRECTION_FIELD_REASON,
    CORRECTION_FIELDS,
    isCorrectionReporterRelation,
    isFacilityCorrectionReason
} from '../corrections/facilityCorrection.js'

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
        && (!fitsFieldLimit('website', website) || httpsUrl(website) === null || !isValidWebsite(website))) {
        errors.push(invalid('website', ErrorCode.INVALID_WEBSITE))
    }
    return errors
}

/** The controlled payment list, the same check as a facility update (#20). */
function paymentErrors(options: gqlTypes.PaymentOptionsInput[]): ValidationError[] {
    const result: Result<unknown> = { data: undefined, hasErrors: false, errors: [] }
    validatePaymentOptions(options, result)
    return result.errors ?? []
}

function listingUrlErrors(value: string): ValidationError[] {
    const url = fitsFieldLimit('listingUrl', value) ? httpsUrl(value.trim()) : null

    if (url === null || !LISTING_HOSTS.has(url.hostname)) {
        return [invalid('duplicateListingUrl', ErrorCode.INVALID_LISTING_URL)]
    }
    return []
}

function notesErrors(notes: string): ValidationError[] {
    if (!fitsFieldLimit('correctionNotes', notes)) {
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
