/**
 * Retention for booking uploads.
 *
 * Identity documents (insurance card, eligibility certificate, マイナポータル
 * screenshot, the patient's photo) are high-risk under APPI. A My Number card or
 * its number is never collected. They are kept only until retain_until, then
 * a purge run deletes the object. Standard attachments use a longer default.
 *
 * Answers on the submission row follow one rule for every field (#212): they
 * are erased a set number of days after the visit ends, and at once when the
 * visit is cancelled or declined (src/booking/answerPurge.ts).
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

/**
 * Default days a patient's answers stay after the visit ends (#212). A request with
 * no appointment counts from when it was sent. The clinic copies what it needs into
 * its own chart; the medical record duty is the clinic's, not Find a Doc's.
 */
export const ANSWER_RETENTION_DAYS_AFTER_VISIT = 90

/** Days answers stay after the visit, from BOOKING_ANSWER_RETENTION_DAYS when it is a positive number. */
export function answerRetentionDays(): number {
    const raw = process.env.BOOKING_ANSWER_RETENTION_DAYS
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : ANSWER_RETENTION_DAYS_AFTER_VISIT
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
