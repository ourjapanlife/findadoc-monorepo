import * as gqlTypes from '@findadoc/graphql'
import type { CorrectionChanges } from '../typeDefs/kyselyTypes.js'

/**
 * Rules for a visitor's correction to a published facility (#22).
 *
 * Each changed field belongs to one reason. A field sent without its reason is refused,
 * so a "wrong payment" report cannot carry a name or an address. Approval writes only the
 * keys present in correction_changes.
 */

/** The input fields a visitor may change, and the reason each one needs. */
export const CORRECTION_FIELD_REASON = {
    address: gqlTypes.FacilityCorrectionReason.WrongCity,
    phone: gqlTypes.FacilityCorrectionReason.WrongContact,
    website: gqlTypes.FacilityCorrectionReason.WrongContact,
    supportedLanguages: gqlTypes.FacilityCorrectionReason.WrongLanguages,
    paymentOptions: gqlTypes.FacilityCorrectionReason.WrongPayment,
    duplicateListingUrl: gqlTypes.FacilityCorrectionReason.Duplicate
} as const satisfies Partial<Record<keyof gqlTypes.FacilityCorrectionInput, gqlTypes.FacilityCorrectionReason>>

export type CorrectionField = keyof typeof CORRECTION_FIELD_REASON

export const CORRECTION_FIELDS = Object.keys(CORRECTION_FIELD_REASON) as CorrectionField[]

const REASONS: ReadonlySet<string> = new Set(Object.values(gqlTypes.FacilityCorrectionReason))
const RELATIONS: ReadonlySet<string> = new Set(Object.values(gqlTypes.CorrectionReporterRelation))

export function isFacilityCorrectionReason(value: unknown): value is gqlTypes.FacilityCorrectionReason {
    return typeof value === 'string' && REASONS.has(value)
}

export function isCorrectionReporterRelation(value: unknown): value is gqlTypes.CorrectionReporterRelation {
    return typeof value === 'string' && RELATIONS.has(value)
}

/** The changes to store: only the fields the visitor sent. cityId is never taken from a visitor. */
export function correctionChangesFromInput(input: gqlTypes.FacilityCorrectionInput): CorrectionChanges {
    const changes: CorrectionChanges = {}

    if (input.address !== undefined && input.address !== null) {
        changes.address = input.address
    }
    if (input.phone !== undefined && input.phone !== null) {
        changes.phone = input.phone.trim()
    }
    if (input.website !== undefined && input.website !== null) {
        changes.website = input.website.trim()
    }
    if (input.supportedLanguages !== undefined && input.supportedLanguages !== null) {
        changes.supportedLanguages = [...new Set(input.supportedLanguages)]
    }
    if (input.paymentOptions !== undefined && input.paymentOptions !== null) {
        changes.paymentOptions = input.paymentOptions
    }

    return changes
}

/**
 * The facility update an approved correction applies. Only keys the visitor changed are set.
 * Contact is rebuilt from the stored contact so an untouched phone, email, or website stays.
 * A WRONG_CITY correction carries the city a moderator chose; the caller refuses it without one.
 */
export function facilityUpdateFromCorrection(
    changes: CorrectionChanges,
    storedContact: gqlTypes.Contact | gqlTypes.ContactInput | null | undefined
): Partial<gqlTypes.UpdateFacilityInput> {
    const update: Partial<gqlTypes.UpdateFacilityInput> = {}

    if (changes.address !== undefined || changes.phone !== undefined || changes.website !== undefined) {
        // An omitted address and Maps URL keep the stored values (contactUpdateForStorage).
        update.contact = {
            phone: changes.phone ?? storedContact?.phone ?? '',
            email: storedContact?.email ?? '',
            website: changes.website ?? storedContact?.website ?? '',
            ...(changes.address === undefined ? {} : { address: changes.address })
        }
    }
    if (changes.supportedLanguages !== undefined) {
        update.supportedLanguages = changes.supportedLanguages
    }
    if (changes.paymentOptions !== undefined) {
        update.paymentOptions = changes.paymentOptions
    }
    if (changes.cityId !== undefined) {
        update.cityId = changes.cityId
    }

    return update
}

/** The GraphQL view of a stored correction. */
export function facilityCorrectionFromColumns(columns: {
    facilityId: string
    reasons: gqlTypes.FacilityCorrectionReason[] | null
    changes: CorrectionChanges | null
    reporterRelation: gqlTypes.CorrectionReporterRelation | null
    duplicateListingUrl: string | null
}): gqlTypes.FacilityCorrection {
    const changes = columns.changes ?? {}

    return {
        facilityId: columns.facilityId,
        reasons: (columns.reasons ?? []).filter(isFacilityCorrectionReason),
        changes: {
            address: changes.address ?? null,
            phone: changes.phone ?? null,
            website: changes.website ?? null,
            supportedLanguages: changes.supportedLanguages ?? null,
            paymentOptions: changes.paymentOptions ?? null,
            cityId: changes.cityId ?? null
        },
        reporterRelation: isCorrectionReporterRelation(columns.reporterRelation) ? columns.reporterRelation : null,
        duplicateListingUrl: columns.duplicateListingUrl
    }
}
