import {
    BookingBankAccountType,
    BookingCardPaymentMode,
    type UpdateBookingPaymentSettingsInput
} from '@findadoc/graphql'
import { ErrorCode } from '../result.js'
import { UUID_REGEX } from './validateFacility.js'

export const MAX_PAYMENT_URL_LENGTH = 2048
export const MAX_BANK_TEXT_LENGTH = 100
/** Generous: an initial consultation fee is far below this. It keeps a typo from reaching patients. */
export const MAX_FEE_JPY = 10_000_000

const ACCOUNT_NUMBER_PATTERN = /^[0-9]{1,8}$/

export type CardMode = 'fixed_link' | 'sent_by_staff'
export type BankAccountType = 'ordinary' | 'checking'

/** The clean row values, before the QR key, which the service checks against storage. */
export type ValidPaymentSettings = {
    facilityId: string
    cardMode: CardMode
    cardUrl: string | null
    bankName: string | null
    bankBranch: string | null
    bankAccountType: BankAccountType | null
    bankAccountNumber: string | null
    bankAccountHolder: string | null
    feeJpy: number | null
}

export type PaymentSettingsError = { field: string, errorCode: ErrorCode }

/**
 * The link as the URL parser writes it, when it is an absolute https URL with a host and no
 * user name or password; otherwise null. Card payment links go into patient emails, so http,
 * javascript:, and data: never pass. Storing the parsed form means `HTTPS://Example.com` is saved
 * as `https://example.com/`, which the database CHECK (`LIKE 'https://%'`) accepts, and a tab or
 * line break pasted inside the link never reaches the email.
 */
export function normalizedHttpsUrl(value: string): string | null {
    if (value.length > MAX_PAYMENT_URL_LENGTH) {
        return null
    }
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return null
    }
    const valid = url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
    return valid && url.href.length <= MAX_PAYMENT_URL_LENGTH ? url.href : null
}

/** True for a link normalizedHttpsUrl accepts. */
export function isHttpsUrl(value: string): boolean {
    return normalizedHttpsUrl(value) !== null
}

/** Blank becomes null, so clearing a field in the dashboard clears it in the email. */
function optionalText(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? ''
    return trimmed === '' ? null : trimmed
}

function bankTextError(input: UpdateBookingPaymentSettingsInput): PaymentSettingsError | null {
    const fields = ['bankName', 'bankBranch', 'bankAccountHolder'] as const
    for (const field of fields) {
        const value = optionalText(input[field])
        if (value !== null && value.length > MAX_BANK_TEXT_LENGTH) {
            return { field, errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG }
        }
    }
    const accountNumber = optionalText(input.bankAccountNumber)
    if (accountNumber !== null && !ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
        return { field: 'bankAccountNumber', errorCode: ErrorCode.INVALID_INPUT }
    }
    return null
}

function feeError(feeJpy: number | null): PaymentSettingsError | null {
    if (feeJpy === null) {
        return null
    }
    if (!Number.isInteger(feeJpy)) {
        return { field: 'feeJpy', errorCode: ErrorCode.INVALID_INPUT }
    }
    if (feeJpy < 0) {
        return { field: 'feeJpy', errorCode: ErrorCode.NEGATIVE_NUMBER }
    }
    return feeJpy > MAX_FEE_JPY ? { field: 'feeJpy', errorCode: ErrorCode.MAX_LIMIT } : null
}

function cardError(cardMode: CardMode, cardUrl: string | null): PaymentSettingsError | null {
    if (cardUrl !== null && !isHttpsUrl(cardUrl)) {
        return { field: 'cardUrl', errorCode: ErrorCode.INVALID_WEBSITE }
    }
    if (cardMode === 'fixed_link' && cardUrl === null) {
        return { field: 'cardUrl', errorCode: ErrorCode.REQUIRED }
    }
    return null
}

/**
 * Checks the payment settings form (online consult v2 §3.3). Returns the clean values,
 * or the first field that is wrong with its error code. A fixed card link needs an https URL.
 */
export function validatePaymentSettings(
    input: UpdateBookingPaymentSettingsInput
): { value: ValidPaymentSettings } | { error: PaymentSettingsError } {
    const facilityId = input.facilityId.trim()
    if (!UUID_REGEX.test(facilityId)) {
        return { error: { field: 'facilityId', errorCode: ErrorCode.INVALID_ID } }
    }
    const cardMode: CardMode = input.cardMode === BookingCardPaymentMode.FixedLink ? 'fixed_link' : 'sent_by_staff'
    const typedCardUrl = optionalText(input.cardUrl)
    const feeJpy = input.feeJpy ?? null
    const error = cardError(cardMode, typedCardUrl) ?? bankTextError(input) ?? feeError(feeJpy)
    if (error !== null) {
        return { error }
    }
    const accountType = input.bankAccountType ?? null
    return {
        value: {
            facilityId,
            cardMode,
            cardUrl: typedCardUrl === null ? null : normalizedHttpsUrl(typedCardUrl),
            bankName: optionalText(input.bankName),
            bankBranch: optionalText(input.bankBranch),
            bankAccountType: accountType === null
                ? null
                : accountType === BookingBankAccountType.Checking ? 'checking' : 'ordinary',
            bankAccountNumber: optionalText(input.bankAccountNumber),
            bankAccountHolder: optionalText(input.bankAccountHolder),
            feeJpy
        }
    }
}
