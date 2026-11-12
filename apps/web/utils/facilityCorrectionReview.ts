import {
    FacilityCorrectionReason,
    type Facility,
    type FacilityCorrection,
    type PhysicalAddress
} from '@findadoc/graphql'
import { CORRECTION_REASON_OPTIONS, isValidListingUrl } from '~/utils/facilityCorrection'

/**
 * The moderation review of a clinic correction (#22). Pure functions only: the review screen
 * shows what the clinic page says now next to what the visitor sent, one row per changed field.
 * Approval writes only these fields (apps/server/docs/facility-corrections.md).
 */

export type CorrectionChangeField = 'address' | 'phone' | 'website' | 'supportedLanguages' | 'paymentOptions'

export type CorrectionChangeRow = {
    field: CorrectionChangeField
    /** The reason the visitor picked for this field. The row sits under its chip. */
    reason: FacilityCorrectionReason
    labelKey: string
    /** A list field shows chips and marks what was added or removed. A text field shows lines. */
    list: boolean
    before: string[]
    after: string[]
    added: string[]
    removed: string[]
}

/** The facility fields a correction can change, as the clinic page shows them today. */
export type CorrectionReviewFacility = Pick<Facility, 'contact' | 'supportedLanguages' | 'paymentOptions'>

const FIELD_REASON: Readonly<Record<CorrectionChangeField, FacilityCorrectionReason>> = {
    address: FacilityCorrectionReason.WrongCity,
    phone: FacilityCorrectionReason.WrongContact,
    website: FacilityCorrectionReason.WrongContact,
    supportedLanguages: FacilityCorrectionReason.WrongLanguages,
    paymentOptions: FacilityCorrectionReason.WrongPayment
}

const FIELD_LABEL_KEYS: Readonly<Record<CorrectionChangeField, string>> = {
    address: 'modCorrectionReview.fieldAddress',
    phone: 'modCorrectionReview.fieldPhone',
    website: 'modCorrectionReview.fieldWebsite',
    supportedLanguages: 'modCorrectionReview.fieldLanguages',
    paymentOptions: 'modCorrectionReview.fieldPayment'
}

/** In the order the reasons appear, and inside a reason in the order the form shows the fields. */
const FIELD_ORDER: readonly CorrectionChangeField[] = CORRECTION_REASON_OPTIONS.flatMap(option =>
    (Object.keys(FIELD_REASON) as CorrectionChangeField[]).filter(field => FIELD_REASON[field] === option.reason))

function joined(parts: readonly (string | null | undefined)[], separator: string): string {
    return parts.map(part => part?.trim() ?? '').filter(part => part !== '').join(separator)
}

/** One English line and one Japanese line. An empty side is left out. */
export function addressLines(address: PhysicalAddress | null | undefined): string[] {
    if (!address) {
        return []
    }
    const english = joined([
        joined([address.addressLine1En, address.addressLine2En], ' '),
        address.cityEn,
        joined([address.prefectureEn, address.postalCode], ' ')
    ], ', ')
    const japanese = joined([
        address.postalCode ? `〒${address.postalCode.trim()}` : '',
        joined([address.prefectureJa, address.cityJa, address.addressLine1Ja, address.addressLine2Ja], '')
    ], ' ')
    return [english, japanese].filter(line => line !== '')
}

function textLines(value: string | null | undefined): string[] {
    const trimmed = value?.trim() ?? ''
    return trimmed === '' ? [] : [trimmed]
}

function listRow(field: CorrectionChangeField, before: readonly string[], after: readonly string[]): CorrectionChangeRow {
    return {
        field,
        reason: FIELD_REASON[field],
        labelKey: FIELD_LABEL_KEYS[field],
        list: true,
        before: [...before],
        after: [...after],
        added: after.filter(value => !before.includes(value)),
        removed: before.filter(value => !after.includes(value))
    }
}

function textRow(field: CorrectionChangeField, before: string[], after: string[]): CorrectionChangeRow {
    return {
        field,
        reason: FIELD_REASON[field],
        labelKey: FIELD_LABEL_KEYS[field],
        list: false,
        before,
        after,
        added: [],
        removed: []
    }
}

function changeRow(
    field: CorrectionChangeField,
    facility: CorrectionReviewFacility,
    changes: FacilityCorrection['changes']
): CorrectionChangeRow | null {
    switch (field) {
        case 'address':
            return changes.address
                ? textRow(field, addressLines(facility.contact?.address), addressLines(changes.address))
                : null
        case 'phone':
            return changes.phone === null || changes.phone === undefined
                ? null
                : textRow(field, textLines(facility.contact?.phone), textLines(changes.phone))
        case 'website':
            return changes.website === null || changes.website === undefined
                ? null
                : textRow(field, textLines(facility.contact?.website), textLines(changes.website))
        case 'supportedLanguages':
            return changes.supportedLanguages
                ? listRow(field, facility.supportedLanguages ?? [], changes.supportedLanguages)
                : null
        case 'paymentOptions':
            return changes.paymentOptions
                ? listRow(
                    field,
                    (facility.paymentOptions ?? []).map(option => option.paymentType),
                    changes.paymentOptions.map(option => option.paymentType)
                )
                : null
    }
}

/**
 * Before → after for every field the visitor sent. A reason with no field (Closed, Other,
 * Duplicate), or a reason the visitor picked without changing anything, has no row.
 */
export function correctionChangeRows(
    facility: CorrectionReviewFacility,
    correction: Pick<FacilityCorrection, 'changes'>
): CorrectionChangeRow[] {
    return FIELD_ORDER
        .map(field => changeRow(field, facility, correction.changes))
        .filter((row): row is CorrectionChangeRow => row !== null)
}

/** A city change needs a city from the vocabulary before approval. The visitor never sets one (city-rules.md). */
export function correctionNeedsCity(correction: Pick<FacilityCorrection, 'reasons'>): boolean {
    return correction.reasons.includes(FacilityCorrectionReason.WrongCity)
}

/** Approval changes nothing for these. A moderator unpublishes or merges by hand. */
export function correctionHandOffReasons(
    correction: Pick<FacilityCorrection, 'reasons'>
): FacilityCorrectionReason[] {
    return correction.reasons.filter(reason =>
        reason === FacilityCorrectionReason.Closed || reason === FacilityCorrectionReason.Duplicate)
}

/** The visitor's link to the other listing, only when it is an https Find a Doc page. */
export function duplicateListingHref(url: string | null | undefined): string | null {
    const trimmed = url?.trim() ?? ''
    return trimmed !== '' && isValidListingUrl(trimmed) ? trimmed : null
}
