import { parsePhoneNumberFromString } from 'libphonenumber-js'

/*
 * Facility phones are stored in E.164 (`+81312345678`). Visitors are often on overseas SIMs,
 * where a domestic `03…` number does not connect, so the stored form and every `tel:` link are
 * international. Hyphen placement in Japan depends on the area-code length, so formatting comes
 * from libphonenumber metadata, not a hand-written table.
 */

const JAPAN_COUNTRY_CODE = '+81'

// Digits, spaces, hyphens, dots, parentheses, and one leading +. Anything else (an extension, a
// note such as 代表, a second number) is refused rather than silently dropped.
const PHONE_CHARACTERS = /^\+?[\d\s.()-]+$/

/** Folds full-width digits and the many dash characters a Japanese keyboard produces into ASCII. */
function asciiPhoneText(raw: string): string {
    return raw
        .normalize('NFKC')
        .replace(/[‐-―−ーｰ]/g, '-')
        .trim()
}

/**
 * The E.164 form of a Japanese phone number, or null when it is not a valid JP number.
 *
 * Accepts any spacing or hyphens, full-width digits, a leading +81, and the common mistake of
 * keeping the trunk 0 after +81 (`+81 045-641-6961`).
 */
export function toJapanE164(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined) {
        return null
    }
    const text = asciiPhoneText(raw)
    if (text === '' || !PHONE_CHARACTERS.test(text)) {
        return null
    }

    const parsed = parsePhoneNumberFromString(text, 'JP')
    if (parsed === undefined || parsed.country !== 'JP' || !parsed.isValid()) {
        return null
    }
    return parsed.number
}

/** True when the value is a valid Japanese phone number in any accepted spelling. */
export function isValidJapanPhone(raw: string | null | undefined): boolean {
    return toJapanE164(raw) !== null
}

export const PHONE_DISPLAY = {
    NATIONAL: 'national',
    INTERNATIONAL: 'international'
} as const

export type PhoneDisplay = typeof PHONE_DISPLAY[keyof typeof PHONE_DISPLAY]

/**
 * A Japanese number for people to read: `03-1234-5678` (national) or `+81 3-1234-5678`
 * (international). Returns null when the value is not a valid JP number.
 *
 * The international form keeps the Japanese hyphen grouping and drops the trunk 0, so it is the
 * same digits a visitor dials from abroad.
 */
export function formatJapanPhone(raw: string | null | undefined, display: PhoneDisplay): string | null {
    const e164 = toJapanE164(raw)
    if (e164 === null) {
        return null
    }
    const parsed = parsePhoneNumberFromString(e164, 'JP')
    if (parsed === undefined) {
        return null
    }
    const national = parsed.formatNational()
    if (display === PHONE_DISPLAY.NATIONAL) {
        return national
    }
    return `${JAPAN_COUNTRY_CODE} ${national.replace(/^0/, '')}`
}
