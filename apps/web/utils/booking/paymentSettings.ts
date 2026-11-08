/**
 * Checks for the payment settings form (online consult v2 §3.3). They help the clinic fill it in;
 * the API checks every value again.
 */

/** The QR goes inline in every pending-payment email, so the API caps it at 1 MB. */
export const PAYMENT_QR_MAX_BYTES = 1024 * 1024
export const PAYMENT_QR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** True for a PNG, JPEG, or WebP up to 1 MB. The API checks the bytes again on save. */
export function isAcceptedQrFile(file: Pick<File, 'type' | 'size'>): boolean {
    return PAYMENT_QR_TYPES.some(type => type === file.type) && file.size > 0 && file.size <= PAYMENT_QR_MAX_BYTES
}

/** An empty fee is "no fee". Otherwise a whole number of yen, 0 or more; undefined when not. */
export function parseFeeJpy(value: string): number | null | undefined {
    const trimmed = value.trim()
    if (trimmed === '') {
        return null
    }
    if (!/^[0-9]+$/.test(trimmed)) {
        return undefined
    }
    const fee = Number(trimmed)
    return Number.isSafeInteger(fee) ? fee : undefined
}

/** True for an https link, the only kind the API saves (AGENTS.md: stored URLs are https). */
export function isHttpsLink(value: string): boolean {
    try {
        return new URL(value.trim()).protocol === 'https:'
    } catch {
        return false
    }
}
