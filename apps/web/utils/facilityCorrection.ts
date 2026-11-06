import {
    CorrectionReporterRelation,
    FacilityCorrectionReason,
    FacilityVerificationStatus,
    PaymentType,
    type Locale,
    type Facility,
    type FacilityCorrectionInput,
    type PaymentOptionsInput,
    type PhysicalAddressInput
} from '@findadoc/graphql'
import { pairedPrefectureEn, pairedPrefectureJa } from '~/stores/locationsStore'
import { ErrorCode, type ServerError } from '~/typedefs/serverResponse'
import { validatePhoneNumber } from '~/utils/formValidations'
import { SEARCHABLE_LANGUAGES } from '~/utils/homeDirectory'

/**
 * The clinic page correction form (#22). Pure functions only: the component keeps the draft,
 * and this module decides what is shown and what is sent.
 *
 * The API refuses a changed field without its reason, so the form sends a field only when
 * its reason is picked and the visitor changed the value. A reason with no change is still
 * sent: "the phone is wrong" with no new number is useful to a moderator.
 */

/** Matches CORRECTION_NOTES_MAX in apps/server/src/corrections/facilityCorrection.ts. */
export const CORRECTION_NOTES_MAX = 1000

/** The same limits as the API (validateFacilityCorrection.ts and validateAddressInput). */
const WEBSITE_MAX = 512
const ADDRESS_LINE_MAX = 128
const CITY_MAX = 64

/** Matches the server's listing hosts: the apex or www, never a clinic subdomain. */
const LISTING_HOSTS: ReadonlySet<string> = new Set(['findadoc.jp', 'www.findadoc.jp'])

/** The field a reason opens. CLOSED and OTHER open none; DUPLICATE opens the optional link. */
export type CorrectionFieldGroup = 'address' | 'contact' | 'languages' | 'payment' | 'duplicate'

export type CorrectionReasonOption = {
    reason: FacilityCorrectionReason
    labelKey: string
    field: CorrectionFieldGroup | null
}

/** In the order the form shows them. */
export const CORRECTION_REASON_OPTIONS: readonly CorrectionReasonOption[] = [
    { reason: FacilityCorrectionReason.WrongCity, labelKey: 'clinicCorrection.reasonWrongCity', field: 'address' },
    { reason: FacilityCorrectionReason.Closed, labelKey: 'clinicCorrection.reasonClosed', field: null },
    { reason: FacilityCorrectionReason.WrongLanguages, labelKey: 'clinicCorrection.reasonWrongLanguages', field: 'languages' },
    { reason: FacilityCorrectionReason.WrongPayment, labelKey: 'clinicCorrection.reasonWrongPayment', field: 'payment' },
    { reason: FacilityCorrectionReason.WrongContact, labelKey: 'clinicCorrection.reasonWrongContact', field: 'contact' },
    { reason: FacilityCorrectionReason.Duplicate, labelKey: 'clinicCorrection.reasonDuplicate', field: 'duplicate' },
    { reason: FacilityCorrectionReason.Other, labelKey: 'clinicCorrection.reasonOther', field: null }
]

export const CORRECTION_RELATION_OPTIONS: readonly { relation: CorrectionReporterRelation, labelKey: string }[] = [
    { relation: CorrectionReporterRelation.Patient, labelKey: 'clinicCorrection.relationPatient' },
    { relation: CorrectionReporterRelation.Staff, labelKey: 'clinicCorrection.relationStaff' },
    { relation: CorrectionReporterRelation.Called, labelKey: 'clinicCorrection.relationCalled' },
    { relation: CorrectionReporterRelation.Website, labelKey: 'clinicCorrection.relationWebsite' }
]

export const PAYMENT_TYPE_OPTIONS: readonly { paymentType: PaymentType, labelKey: string }[] = [
    { paymentType: PaymentType.Cash, labelKey: 'clinicCorrection.paymentCash' },
    { paymentType: PaymentType.CreditCard, labelKey: 'clinicCorrection.paymentCreditCard' },
    { paymentType: PaymentType.DebitCard, labelKey: 'clinicCorrection.paymentDebitCard' },
    { paymentType: PaymentType.ElectronicMoney, labelKey: 'clinicCorrection.paymentElectronicMoney' },
    { paymentType: PaymentType.QrCode, labelKey: 'clinicCorrection.paymentQrCode' },
    { paymentType: PaymentType.Insurance, labelKey: 'clinicCorrection.paymentInsurance' }
]

export type CorrectionDraft = {
    reasons: FacilityCorrectionReason[]
    address: PhysicalAddressInput
    phone: string
    website: string
    supportedLanguages: Locale[]
    paymentTypes: PaymentType[]
    duplicateListingUrl: string
    notes: string
    reporterRelation: CorrectionReporterRelation | null
}

/** What the clinic page shows today. The draft starts from it and the input is compared with it. */
export type CorrectionBaseline = Pick<Facility, 'id' | 'contact' | 'supportedLanguages' | 'paymentOptions'>

/** The louder "Help us confirm this listing" card is for any listing a moderator has not confirmed. */
export function correctionPromptVariant(
    verificationStatus: FacilityVerificationStatus | null | undefined
): 'confirm' | 'error' {
    return verificationStatus === FacilityVerificationStatus.Confirmed ? 'error' : 'confirm'
}

function addressFromBaseline(baseline: CorrectionBaseline): PhysicalAddressInput {
    const address = baseline.contact?.address
    return {
        postalCode: address?.postalCode ?? '',
        prefectureEn: address?.prefectureEn ?? '',
        cityEn: address?.cityEn ?? '',
        addressLine1En: address?.addressLine1En ?? '',
        addressLine2En: address?.addressLine2En ?? '',
        prefectureJa: address?.prefectureJa ?? '',
        cityJa: address?.cityJa ?? '',
        addressLine1Ja: address?.addressLine1Ja ?? '',
        addressLine2Ja: address?.addressLine2Ja ?? ''
    }
}

/** A draft pre-filled with the current values, so the visitor only edits what is wrong. */
export function correctionDraftFromBaseline(baseline: CorrectionBaseline): CorrectionDraft {
    return {
        reasons: [],
        address: addressFromBaseline(baseline),
        phone: baseline.contact?.phone ?? '',
        website: baseline.contact?.website ?? '',
        supportedLanguages: [...(baseline.supportedLanguages ?? [])],
        paymentTypes: (baseline.paymentOptions ?? []).map(option => option.paymentType),
        duplicateListingUrl: '',
        notes: '',
        reporterRelation: null
    }
}

/** The field groups to show, one per picked reason that has a field, in reason order. */
export function visibleCorrectionFields(reasons: readonly FacilityCorrectionReason[]): CorrectionFieldGroup[] {
    return CORRECTION_REASON_OPTIONS
        .filter(option => option.field !== null && reasons.includes(option.reason))
        .map(option => option.field as CorrectionFieldGroup)
}

/** Picks or unpicks a reason, keeping the form's reason order. */
export function toggleCorrectionReason(
    reasons: readonly FacilityCorrectionReason[],
    reason: FacilityCorrectionReason
): FacilityCorrectionReason[] {
    const picked = new Set(reasons)
    if (picked.has(reason)) {
        picked.delete(reason)
    } else {
        picked.add(reason)
    }
    return CORRECTION_REASON_OPTIONS.map(option => option.reason).filter(option => picked.has(option))
}

/**
 * The languages the form offers: the searchable list, plus any the clinic already lists so a
 * visitor can remove it. English first, Japanese next, as in search.
 */
export function correctionLanguageOptions(current: readonly Locale[]): Locale[] {
    const options: Locale[] = [...SEARCHABLE_LANGUAGES]
    for (const language of current) {
        if (!options.includes(language)) {
            options.push(language)
        }
    }
    return options
}

/** Sets both prefecture names from the one the visitor picked, in either language. */
export function addressWithPrefecture(
    address: PhysicalAddressInput,
    prefecture: string,
    japanese: boolean
): PhysicalAddressInput {
    return japanese
        ? { ...address, prefectureJa: prefecture, prefectureEn: pairedPrefectureEn(prefecture) || address.prefectureEn }
        : { ...address, prefectureEn: prefecture, prefectureJa: pairedPrefectureJa(prefecture) || address.prefectureJa }
}

function trimmedAddress(address: PhysicalAddressInput): PhysicalAddressInput {
    return {
        postalCode: address.postalCode.trim(),
        prefectureEn: address.prefectureEn.trim(),
        cityEn: address.cityEn.trim(),
        addressLine1En: address.addressLine1En.trim(),
        addressLine2En: address.addressLine2En.trim(),
        prefectureJa: address.prefectureJa.trim(),
        cityJa: address.cityJa.trim(),
        addressLine1Ja: address.addressLine1Ja.trim(),
        addressLine2Ja: address.addressLine2Ja.trim()
    }
}

function sameAddress(left: PhysicalAddressInput, right: PhysicalAddressInput): boolean {
    return (Object.keys(left) as (keyof PhysicalAddressInput)[]).every(key => left[key] === right[key])
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
    const leftSet = new Set(left)
    const rightSet = new Set(right)
    return leftSet.size === rightSet.size && [...leftSet].every(value => rightSet.has(value))
}

/** Brands the clinic already lists stay on a payment type the visitor kept. A new type has none. */
function paymentOptionsFromTypes(
    paymentTypes: readonly PaymentType[],
    baseline: CorrectionBaseline
): PaymentOptionsInput[] {
    return PAYMENT_TYPE_OPTIONS
        .map(option => option.paymentType)
        .filter(paymentType => paymentTypes.includes(paymentType))
        .map(paymentType => ({
            paymentType,
            paymentBrands: [...(baseline.paymentOptions ?? [])
                .find(option => option.paymentType === paymentType)?.paymentBrands ?? []]
        }))
}

/**
 * The mutation input: the picked reasons, and each field only when its reason is picked and
 * the value differs from what the page shows. Free text is trimmed and an empty note is left out.
 */
export function correctionInputFromDraft(
    draft: CorrectionDraft,
    baseline: CorrectionBaseline
): FacilityCorrectionInput {
    const reasons = new Set(draft.reasons)
    const before = correctionDraftFromBaseline(baseline)
    const input: FacilityCorrectionInput = { facilityId: baseline.id, reasons: [...draft.reasons] }

    const address = trimmedAddress(draft.address)
    if (reasons.has(FacilityCorrectionReason.WrongCity) && !sameAddress(address, trimmedAddress(before.address))) {
        input.address = address
    }
    if (reasons.has(FacilityCorrectionReason.WrongContact)) {
        if (draft.phone.trim() !== before.phone.trim()) {
            input.phone = draft.phone.trim()
        }
        if (draft.website.trim() !== before.website.trim()) {
            input.website = draft.website.trim()
        }
    }
    if (reasons.has(FacilityCorrectionReason.WrongLanguages)
      && !sameSet(draft.supportedLanguages, before.supportedLanguages)) {
        input.supportedLanguages = [...new Set(draft.supportedLanguages)]
    }
    if (reasons.has(FacilityCorrectionReason.WrongPayment) && !sameSet(draft.paymentTypes, before.paymentTypes)) {
        input.paymentOptions = paymentOptionsFromTypes(draft.paymentTypes, baseline)
    }
    if (reasons.has(FacilityCorrectionReason.Duplicate) && draft.duplicateListingUrl.trim() !== '') {
        input.duplicateListingUrl = draft.duplicateListingUrl.trim()
    }

    const notes = draft.notes.trim()
    if (notes !== '') {
        input.notes = notes
    }
    if (draft.reporterRelation !== null) {
        input.reporterRelation = draft.reporterRelation
    }
    return input
}

function httpsUrl(value: string): URL | null {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? url : null
    } catch {
        return null
    }
}

/** Empty, or an https link to a Find a Doc listing. The API checks the same rule. */
export function isValidListingUrl(value: string): boolean {
    const trimmed = value.trim()
    if (trimmed === '') {
        return true
    }
    const url = httpsUrl(trimmed)
    return url !== null && LISTING_HOSTS.has(url.hostname)
}

const INVALID_INPUT_CODES: ReadonlySet<ErrorCode> = new Set([
    ErrorCode.BAD_USER_INPUT,
    ErrorCode.INVALID_INPUT,
    ErrorCode.INVALID_PHONE_NUMBER,
    ErrorCode.INVALID_WEBSITE,
    ErrorCode.INVALID_LENGTH_TOO_LONG,
    ErrorCode.INVALID_LANGUAGE_INPUT,
    ErrorCode.MAX_LIMIT,
    ErrorCode.REQUIRED,
    ErrorCode.CORRECTION_FIELD_WITHOUT_REASON
])

export type CorrectionRefusal = 'rateLimited' | 'unavailable' | 'invalidListingUrl' | 'invalid' | 'failed'

/**
 * The one sentence the form shows for a refused correction. The API names the rule it
 * refused; the visitor needs to know whether to fix the form or try later.
 */
export function correctionRefusal(errors: readonly Pick<ServerError, 'code'>[] | undefined): CorrectionRefusal {
    const codes = new Set((errors ?? []).map(error => error.code))
    if (codes.has(ErrorCode.TOO_MANY_REQUESTS)) {
        return 'rateLimited'
    }
    if (codes.has(ErrorCode.FACILITY_NOT_PUBLISHED) || codes.has(ErrorCode.NOT_FOUND)) {
        return 'unavailable'
    }
    if (codes.has(ErrorCode.INVALID_LISTING_URL)) {
        return 'invalidListingUrl'
    }
    if ([...codes].some(code => INVALID_INPUT_CODES.has(code))) {
        return 'invalid'
    }
    return 'failed'
}

/** Empty clears the website. Anything else must be https, like every stored website. */
export function isValidCorrectionWebsite(value: string): boolean {
    const trimmed = value.trim()
    return trimmed === '' || (trimmed.length <= WEBSITE_MAX && httpsUrl(trimmed) !== null)
}

export type CorrectionDraftField = 'reasons' | 'phone' | 'website' | 'duplicateListingUrl' | 'address'

/**
 * The checks the visitor can fix before sending, keyed by field, each with its message key.
 * The API checks all of them again; these exist so the visitor sees the problem next to the field.
 */
export function correctionDraftErrors(
    draft: CorrectionDraft,
    baseline: CorrectionBaseline
): Partial<Record<CorrectionDraftField, string>> {
    const errors: Partial<Record<CorrectionDraftField, string>> = {}
    const reasons = new Set(draft.reasons)

    if (reasons.size === 0) {
        errors.reasons = 'clinicCorrection.reasonsRequired'
    }
    if (reasons.has(FacilityCorrectionReason.WrongContact)) {
        const phone = draft.phone.trim()
        const phoneChanged = phone !== (baseline.contact?.phone ?? '').trim()
        if (phoneChanged && !validatePhoneNumber(phone)) {
            errors.phone = 'clinicCorrection.phoneInvalid'
        }
        if (!isValidCorrectionWebsite(draft.website)) {
            errors.website = 'clinicCorrection.websiteInvalid'
        }
    }
    if (reasons.has(FacilityCorrectionReason.WrongCity)) {
        const address = trimmedAddress(draft.address)
        const lines = [address.addressLine1En, address.addressLine2En, address.addressLine1Ja, address.addressLine2Ja]
        const cities = [address.cityEn, address.cityJa]
        if (lines.some(line => line.length > ADDRESS_LINE_MAX) || cities.some(city => city.length > CITY_MAX)) {
            errors.address = 'clinicCorrection.addressTooLong'
        }
    }
    if (reasons.has(FacilityCorrectionReason.Duplicate) && !isValidListingUrl(draft.duplicateListingUrl)) {
        errors.duplicateListingUrl = 'clinicCorrection.duplicateInvalid'
    }
    return errors
}
