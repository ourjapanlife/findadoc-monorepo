import type { Selectable } from 'kysely'
import { db } from '../kyselyClient.js'
import type { BookingPaymentSettingsTable } from '../typeDefs/kyselyTypes.js'

/**
 * A clinic's payment settings as the pending-payment email reads them (online consult v2 §3.3).
 * Each method is null when a setting it needs is missing, so the email falls back to
 * "the clinic will send payment instructions" for that method.
 */
export type PaymentSettingsRow = Selectable<BookingPaymentSettingsTable>

export type BankDetails = {
    bankName: string
    bankBranch: string
    accountType: 'ordinary' | 'checking'
    accountNumber: string
    accountHolder: string
}

export type CardInstructions =
    | { mode: 'fixed_link', url: string }
    | { mode: 'sent_by_staff' }

export type ClinicPaymentDetails = {
    feeJpy: number | null
    card: CardInstructions | null
    bank: BankDetails | null
    payPayQrObjectKey: string | null
}

export async function paymentSettingsRow(facilityId: string): Promise<PaymentSettingsRow | undefined> {
    return db.selectFrom('booking_payment_settings')
        .selectAll()
        .where('facility_id', '=', facilityId)
        .executeTakeFirst()
}

/** Bank transfer needs all five fields. A partial account would send the patient's money nowhere. */
function bankDetails(row: PaymentSettingsRow): BankDetails | null {
    const details = {
        bankName: row.bank_name,
        bankBranch: row.bank_branch,
        accountType: row.bank_account_type,
        accountNumber: row.bank_account_number,
        accountHolder: row.bank_account_holder
    }
    if (details.bankName === null || details.bankBranch === null || details.accountType === null
        || details.accountNumber === null || details.accountHolder === null) {
        return null
    }
    return {
        bankName: details.bankName,
        bankBranch: details.bankBranch,
        accountType: details.accountType,
        accountNumber: details.accountNumber,
        accountHolder: details.accountHolder
    }
}

function cardInstructions(row: PaymentSettingsRow): CardInstructions | null {
    if (row.card_mode === 'sent_by_staff') {
        return { mode: 'sent_by_staff' }
    }
    return row.card_url === null ? null : { mode: 'fixed_link', url: row.card_url }
}

/** The email's view of a row. No row means every method falls back. */
export function paymentDetailsFromRow(row: PaymentSettingsRow | undefined): ClinicPaymentDetails {
    if (row === undefined) {
        return { feeJpy: null, card: null, bank: null, payPayQrObjectKey: null }
    }
    return {
        feeJpy: row.fee_jpy,
        card: cardInstructions(row),
        bank: bankDetails(row),
        payPayQrObjectKey: row.paypay_qr_object_key
    }
}
