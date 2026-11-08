import type { InlineAttachment } from '../email/sesClient.js'
import { logger } from '../logger.js'
import {
    PAYMENT_QR_CONTENT_TYPES,
    PAYMENT_QR_MAX_BYTES,
    imageTypeFromBytes,
    readClinicAsset
} from '../storage/clinicAssetStorage.js'
import type { BookingEmail, EmailBrand } from './emailCopy.js'
import { isPaymentMethod, type PaymentMethod } from './formDefinitions.js'
import { PAYPAY_QR_CONTENT_ID, patientPendingPaymentEmail } from './paymentEmailCopy.js'
import { paymentDetailsFromRow, paymentSettingsRow, type ClinicPaymentDetails } from './paymentSettings.js'

async function clinicPaymentDetails(facilityId: string | null): Promise<ClinicPaymentDetails> {
    if (facilityId === null) {
        return paymentDetailsFromRow(undefined)
    }
    try {
        return paymentDetailsFromRow(await paymentSettingsRow(facilityId))
    } catch (error) {
        // The email still goes out, with "the clinic will contact you" for the method.
        logger.warn('Payment settings unreadable for the pending-payment email', {
            facilityId,
            error: error instanceof Error ? error.name : 'unknown'
        })
        return paymentDetailsFromRow(undefined)
    }
}

/** The stored QR as an inline image, or null when it is missing, too large, or not an image. */
async function payPayQrAttachment(objectKey: string | null): Promise<InlineAttachment | null> {
    if (objectKey === null) {
        return null
    }
    const bytes = await readClinicAsset(objectKey)
    if (bytes === null || bytes.byteLength > PAYMENT_QR_MAX_BYTES) {
        return null
    }
    const contentType = imageTypeFromBytes(bytes)
    if (contentType === null) {
        return null
    }
    return {
        contentId: PAYPAY_QR_CONTENT_ID,
        fileName: `paypay-qr.${PAYMENT_QR_CONTENT_TYPES[contentType]}`,
        contentType,
        content: bytes
    }
}

/**
 * Builds the pending-payment email for one new request (online consult v2 §3.4): reads the
 * clinic's payment settings and, for PayPay, the QR image that goes inline. A missing or
 * unreadable setting never blocks the email; that method falls back to "the clinic will contact you".
 */
export async function pendingPaymentEmail(input: {
    facilityId: string | null
    locale: string | null
    clinicName: string
    startsAt: Date
    durationMinutes: number | null
    reference: string
    manageUrl: string
    /** The stored paymentMethod answer. Anything but a known method reads as not chosen. */
    paymentAnswer: unknown
    brand?: EmailBrand | null
}): Promise<BookingEmail> {
    const method: PaymentMethod | null = isPaymentMethod(input.paymentAnswer) ? input.paymentAnswer : null
    const details = await clinicPaymentDetails(input.facilityId)
    const qr = method === 'payPay' ? await payPayQrAttachment(details.payPayQrObjectKey) : null
    const email = patientPendingPaymentEmail({
        locale: input.locale,
        clinicName: input.clinicName,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        reference: input.reference,
        manageUrl: input.manageUrl,
        brand: input.brand ?? null,
        instructions: {
            method,
            feeJpy: details.feeJpy,
            card: details.card,
            bank: details.bank,
            payPayQr: qr !== null
        }
    })
    return qr === null ? email : { ...email, inlineAttachments: [qr] }
}
