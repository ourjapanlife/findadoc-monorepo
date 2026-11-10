/**
 * Longest text the API accepts for these fields. The web forms use the same numbers for
 * `maxlength` and their own checks, so a form and the API cannot drift apart.
 * Change a limit here, never in a form or a validator.
 */
export const FIELD_LIMITS = {
    /** A Japanese postal code with any spacing the visitor typed. */
    postalCode: 18,
    prefecture: 128,
    city: 64,
    addressLine: 128,
    /** Phone text as typed, before it is parsed and stored as E.164. */
    phone: 40,
    website: 512,
    /** The other Find a Doc listing named in a duplicate report. */
    listingUrl: 512,
    /** The free-text note a visitor adds to a clinic correction. */
    correctionNotes: 1000
} as const

export type FieldLimit = keyof typeof FIELD_LIMITS

/** True when the text fits the limit for that field. */
export function fitsFieldLimit(field: FieldLimit, value: string): boolean {
    return value.length <= FIELD_LIMITS[field]
}
