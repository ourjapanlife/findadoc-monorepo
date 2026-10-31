import { prefectureLanguageMatch } from '~/stores/locationsStore'
import type { CreateFacilityInput, UpdateFacilityInput, PhysicalAddressInput } from '@findadoc/graphql'
import type { FacilitySectionFields } from '~/stores/facilitiesStore'
import { translatedFormError } from '~/utils/formErrorMessage'

const REQUIRED_FIELD = 'serverErrorMessages.requiredFieldEmpty'
const PREFECTURE_MISMATCH = 'serverErrorMessages.prefectureMismatch'
const PREFECTURE_REQUIRED = 'serverErrorMessages.prefectureRequired'

export interface FacilityValidationResult {
    valid: boolean
    errors: string[]
}

/** Client-side facility checks. `messageKeys` are i18n keys, one per problem. */
export class FacilityFieldError extends Error {
    readonly messageKeys: readonly string[]

    constructor(messageKeys: readonly string[]) {
        const unique = [...new Set(messageKeys)]
        super(unique.join('; '))
        this.name = 'FacilityFieldError'
        this.messageKeys = unique
    }
}

export function facilityFieldErrorText(
    t: (key: string) => string | undefined,
    messageKeys: readonly string[]
): string {
    const lines = [...new Set(messageKeys)].map(key => translatedFormError(t, key))
    return [...new Set(lines)].join(' ')
}

/**
 * Validates whether prefectureEn and prefectureJa are a matching pair.
 */
export function validatePrefectureMatch(prefectureEn?: string, prefectureJa?: string): boolean {
    if (!prefectureEn && !prefectureJa) return true
    if (!prefectureEn || !prefectureJa) return false

    const lowercasePrefectureEn = prefectureEn.trim().toLowerCase()
    return prefectureLanguageMatch[lowercasePrefectureEn] === prefectureJa
}

/**
 * Checks if a pair of prefecture values match, taking an object with the fields.
 */
export function checkPrefectureNameMatch(fields: { prefectureEn?: string, prefectureJa?: string }): boolean {
    return validatePrefectureMatch(fields.prefectureEn, fields.prefectureJa)
}

/**
 * Base validation for a facility address (only validates prefectures at the moment).
 */
function validateAddress(address?: PhysicalAddressInput | null): FacilityValidationResult {
    const errors: string[] = []
    if (!address) return { valid: true, errors }

    const { prefectureEn, prefectureJa } = address
    if (!validatePrefectureMatch(prefectureEn, prefectureJa)) {
        errors.push(PREFECTURE_MISMATCH)
    }

    return { valid: errors.length === 0, errors }
}

function hasNonEmptyNameAndPhone(input: {
    nameEn?: string | null
    nameJa?: string | null
    phone?: string | null
}): string[] {
    const errors: string[] = []
    if (!input.nameEn?.trim()) errors.push(REQUIRED_FIELD)
    if (!input.nameJa?.trim()) errors.push(REQUIRED_FIELD)
    if (!input.phone?.trim()) errors.push(REQUIRED_FIELD)
    return errors
}

/**
 * Validation specific to facility creation.
 * Online is opt-in: when true, address and map may be omitted. Names and phone stay required.
 */
export function validateCreateFacility(input: CreateFacilityInput): FacilityValidationResult {
    const errors = hasNonEmptyNameAndPhone({
        nameEn: input.nameEn,
        nameJa: input.nameJa,
        phone: input.contact?.phone
    })

    if (input.online === true) {
        return { valid: errors.length === 0, errors }
    }

    const addressValidation = validateAddress(input.contact?.address)
    errors.push(...addressValidation.errors)

    const prefectureEn = input.contact?.address?.prefectureEn
    const prefectureJa = input.contact?.address?.prefectureJa
    if (!prefectureEn || !prefectureJa) {
        errors.push(PREFECTURE_REQUIRED)
    }

    if (!(input.contact?.googleMapsUrl ?? '').trim()) {
        errors.push(REQUIRED_FIELD)
    }

    if (input.mapLatitude === undefined || input.mapLatitude === null || input.mapLatitude === 0) {
        errors.push(REQUIRED_FIELD)
    }
    if (input.mapLongitude === undefined || input.mapLongitude === null || input.mapLongitude === 0) {
        errors.push(REQUIRED_FIELD)
    }

    return { valid: errors.length === 0, errors }
}

function isZeroCoordinatePlaceholder(value: string): boolean {
    const trimmed = value.trim()
    if (!trimmed) return true
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed === 0
}

/**
 * Validation specific to facility updates.
 */
export function validateUpdateFacility(
    fields: FacilitySectionFields,
    updatedInput: UpdateFacilityInput
): FacilityValidationResult {
    const errors: string[] = []
    if (fields.online !== true) {
        const addressValidation = validateAddress(updatedInput.contact?.address)
        if (!addressValidation.valid) {
            errors.push(...addressValidation.errors)
        }
    }

    const alwaysRequiredKeys: (keyof FacilitySectionFields)[] = [
        'nameEn', 'nameJa',
        'phone'
    ]

    const locationKeys: (keyof FacilitySectionFields)[] = [
        'postalCode',
        'cityEn', 'addressLine1En',
        'cityJa', 'addressLine1Ja',
        'googlemapsURL',
        'mapLatitude', 'mapLongitude',
        'prefectureEn', 'prefectureJa'
    ]

    const keysToValidate = fields.online === true
        ? alwaysRequiredKeys
        : [...alwaysRequiredKeys, ...locationKeys]

    for (const key of keysToValidate) {
        const value = fields[key]
        if (typeof value === 'string' && !value.trim()) {
            errors.push(REQUIRED_FIELD)
        }
    }

    if (fields.online !== true) {
        if (isZeroCoordinatePlaceholder(fields.mapLatitude)
          || isZeroCoordinatePlaceholder(fields.mapLongitude)) {
            errors.push(REQUIRED_FIELD)
        }
    }

    return { valid: errors.length === 0, errors }
}
