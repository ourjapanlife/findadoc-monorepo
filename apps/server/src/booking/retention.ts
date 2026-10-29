/**
 * Retention for booking uploads.
 *
 * Identity documents (insurance card, eligibility certificate, マイナポータル
 * screenshot, the patient's photo) are high-risk under APPI. A My Number card or
 * its number is never collected. They are kept only until retain_until, then
 * a purge run deletes the object. Standard attachments use a longer default.
 *
 * Medical free-text answers are not auto-purged here; that needs a separate
 * policy once the CRM export path is decided.
 */

export const BOOKING_FIELD_SENSITIVITY = {
    STANDARD: 'standard',
    IDENTITY_DOCUMENT: 'identity_document',
    MEDICAL: 'medical'
} as const

export type BookingFieldSensitivity
    = typeof BOOKING_FIELD_SENSITIVITY[keyof typeof BOOKING_FIELD_SENSITIVITY]

/** Default days an identity-document upload may stay before purge. */
export const IDENTITY_DOCUMENT_RETENTION_DAYS = 30

/** Default days for non-identity uploads. */
export const STANDARD_UPLOAD_RETENTION_DAYS = 365

export function retentionDaysForSensitivity(sensitivity: BookingFieldSensitivity): number {
    if (sensitivity === BOOKING_FIELD_SENSITIVITY.IDENTITY_DOCUMENT) {
        const raw = process.env.BOOKING_IDENTITY_RETENTION_DAYS
        const parsed = raw ? Number(raw) : NaN
        return Number.isFinite(parsed) && parsed > 0 ? parsed : IDENTITY_DOCUMENT_RETENTION_DAYS
    }
    const raw = process.env.BOOKING_STANDARD_RETENTION_DAYS
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : STANDARD_UPLOAD_RETENTION_DAYS
}

export function retainUntilFromNow(
    sensitivity: BookingFieldSensitivity,
    from: Date = new Date()
): Date {
    const days = retentionDaysForSensitivity(sensitivity)
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

export function isIdentityDocumentSensitivity(value: string): boolean {
    return value === BOOKING_FIELD_SENSITIVITY.IDENTITY_DOCUMENT
}
