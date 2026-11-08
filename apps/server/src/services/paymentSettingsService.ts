import {
    BookingBankAccountType,
    BookingCardPaymentMode,
    type BookingPaymentSettings,
    type CreatePaymentQrUploadUrlInput,
    type PaymentQrUploadUrl,
    type UpdateBookingPaymentSettingsInput
} from '@findadoc/graphql'
import { sql } from 'kysely'
import { canManageFacility, canReadFacility, type BookingAccess } from '../booking/access.js'
import { paymentSettingsRow, type PaymentSettingsRow } from '../booking/paymentSettings.js'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'
import { ErrorCode, type Result } from '../result.js'
import {
    PAYMENT_QR_MAX_BYTES,
    clinicAssetPreviewUrl,
    createPaymentQrUploadTarget,
    imageTypeFromBytes,
    isPaymentQrContentType,
    isPaymentQrKeyFor,
    paymentQrContentType,
    readClinicAsset
} from '../storage/clinicAssetStorage.js'
import { UUID_REGEX } from '../validation/validateFacility.js'
import { validatePaymentSettings, type ValidPaymentSettings } from '../validation/validatePaymentSettings.js'

/**
 * Clinic payment settings for the pending-payment email (online consult v2 §3.3).
 * Members read them; owners and admins change them, as with the other booking settings.
 * Bank details and the QR key are clinic data. They are never logged.
 */

function failure(field: string, errorCode: ErrorCode, httpStatus: number): Result<never> {
    return { data: undefined as never, hasErrors: true, errors: [{ field, errorCode, httpStatus }] }
}

async function toGql(
    row: PaymentSettingsRow,
    access: BookingAccess,
    apiBaseUrl: string
): Promise<BookingPaymentSettings> {
    const qrKey = row.paypay_qr_object_key
    return {
        facilityId: row.facility_id,
        cardMode: row.card_mode === 'fixed_link' ? BookingCardPaymentMode.FixedLink : BookingCardPaymentMode.SentByStaff,
        cardUrl: row.card_url,
        bankName: row.bank_name,
        bankBranch: row.bank_branch,
        bankAccountType: row.bank_account_type === null
            ? null
            : row.bank_account_type === 'checking' ? BookingBankAccountType.Checking : BookingBankAccountType.Ordinary,
        bankAccountNumber: row.bank_account_number,
        bankAccountHolder: row.bank_account_holder,
        hasPayPayQr: qrKey !== null,
        payPayQrPreviewUrl: qrKey === null ? null : await clinicAssetPreviewUrl(qrKey, apiBaseUrl),
        feeJpy: row.fee_jpy,
        canManage: canManageFacility(access, row.facility_id)
    }
}

/** Null when this user may not read the clinic, or the clinic saved no payment settings yet. */
export async function getBookingPaymentSettings(
    facilityId: string,
    access: BookingAccess,
    apiBaseUrl: string
): Promise<BookingPaymentSettings | null> {
    if (!UUID_REGEX.test(facilityId) || !canReadFacility(access, facilityId)) {
        return null
    }
    const row = await paymentSettingsRow(facilityId)
    return row === undefined ? null : toGql(row, access, apiBaseUrl)
}

/**
 * Checks a newly uploaded QR: this facility's key, present, at most 1 MB, and a real PNG,
 * JPEG, or WebP whose bytes match the type in its key. The client's Content-Type is not trusted.
 */
async function qrKeyIsValid(facilityId: string, objectKey: string): Promise<boolean> {
    if (!isPaymentQrKeyFor(facilityId, objectKey)) {
        return false
    }
    const bytes = await readClinicAsset(objectKey)
    if (bytes === null || bytes.byteLength === 0 || bytes.byteLength > PAYMENT_QR_MAX_BYTES) {
        return false
    }
    return imageTypeFromBytes(bytes) === paymentQrContentType(objectKey)
}

/** The QR key to store: the new upload, null to remove, or the current one. */
async function nextQrKey(
    input: UpdateBookingPaymentSettingsInput,
    facilityId: string
): Promise<{ key: string | null } | 'invalid' | 'keep'> {
    const uploaded = input.payPayQrObjectKey?.trim() ?? ''
    if (uploaded !== '') {
        return await qrKeyIsValid(facilityId, uploaded) ? { key: uploaded } : 'invalid'
    }
    return input.removePayPayQr === true ? { key: null } : 'keep'
}

async function saveRow(value: ValidPaymentSettings, qrKey: { key: string | null } | 'keep'): Promise<void> {
    const columns = {
        card_mode: value.cardMode,
        card_url: value.cardUrl,
        bank_name: value.bankName,
        bank_branch: value.bankBranch,
        bank_account_type: value.bankAccountType,
        bank_account_number: value.bankAccountNumber,
        bank_account_holder: value.bankAccountHolder,
        fee_jpy: value.feeJpy,
        ...(qrKey === 'keep' ? {} : { paypay_qr_object_key: qrKey.key })
    }
    await db.insertInto('booking_payment_settings')
        .values({ facility_id: value.facilityId, ...columns })
        .onConflict(conflict => conflict.column('facility_id').doUpdateSet({
            ...columns,
            updated_date: sql`now()`
        }))
        .execute()
}

/** Saves the whole form. Card, bank, and fee are replaced as sent; the QR only changes when asked. */
export async function updateBookingPaymentSettings(
    input: UpdateBookingPaymentSettingsInput,
    access: BookingAccess,
    apiBaseUrl: string
): Promise<Result<BookingPaymentSettings>> {
    const checked = validatePaymentSettings(input)
    if ('error' in checked) {
        return failure(checked.error.field, checked.error.errorCode, 400)
    }
    const { value } = checked
    if (!canManageFacility(access, value.facilityId)) {
        return failure('facilityId', ErrorCode.FORBIDDEN, 403)
    }
    try {
        const facility = await db.selectFrom('facilities')
            .select('id')
            .where('id', '=', value.facilityId)
            .executeTakeFirst()
        if (facility === undefined) {
            return failure('facilityId', ErrorCode.NOT_FOUND, 404)
        }
        const qrKey = await nextQrKey(input, value.facilityId)
        if (qrKey === 'invalid') {
            return failure('payPayQrObjectKey', ErrorCode.PAYMENT_QR_INVALID, 400)
        }
        await saveRow(value, qrKey)
        const saved = await paymentSettingsRow(value.facilityId)
        if (saved === undefined) {
            return failure('facilityId', ErrorCode.SERVER_ERROR, 500)
        }
        return { data: await toGql(saved, access, apiBaseUrl), hasErrors: false }
    } catch (error) {
        // The input holds bank details, so only the error name is logged.
        logger.error('Payment settings save failed', {
            facilityId: value.facilityId,
            error: error instanceof Error ? error.name : 'unknown'
        })
        return failure('facilityId', ErrorCode.SERVER_ERROR, 500)
    }
}

/** A 15-minute PUT for a new PayPay QR. The type and size are checked here and again on save. */
export async function createPaymentQrUploadUrl(
    input: CreatePaymentQrUploadUrlInput,
    access: BookingAccess,
    apiBaseUrl: string
): Promise<Result<PaymentQrUploadUrl>> {
    const facilityId = input.facilityId.trim()
    if (!UUID_REGEX.test(facilityId)) {
        return failure('facilityId', ErrorCode.INVALID_ID, 400)
    }
    if (!canManageFacility(access, facilityId)) {
        return failure('facilityId', ErrorCode.FORBIDDEN, 403)
    }
    const contentType = input.contentType.trim().toLowerCase()
    if (!isPaymentQrContentType(contentType)) {
        return failure('contentType', ErrorCode.PAYMENT_QR_INVALID, 400)
    }
    if (!Number.isInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > PAYMENT_QR_MAX_BYTES) {
        return failure('byteSize', ErrorCode.PAYMENT_QR_INVALID, 400)
    }
    try {
        const target = await createPaymentQrUploadTarget({
            facilityId,
            contentType,
            byteSize: input.byteSize,
            apiBaseUrl
        })
        return { data: target, hasErrors: false }
    } catch (error) {
        logger.error('Payment QR upload URL failed', {
            facilityId,
            error: error instanceof Error ? error.name : 'unknown'
        })
        return failure('facilityId', ErrorCode.SERVER_ERROR, 500)
    }
}
