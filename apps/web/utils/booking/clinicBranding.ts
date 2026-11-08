import type { ClinicBranding } from '@findadoc/graphql'

/** The ClinicBranding selection for BookingForm, BookingClinic, and PatientBookingView (online consult v2 §4). */
export const CLINIC_BRANDING_FIELDS = `
  branding {
    displayName
    wordmark {
      ja
      en
    }
    logoPath
    primary
  }
`

/** Same rule as the API: one leading slash, then no slash, backslash, or whitespace at the start. */
const LOGO_PATH = /^\/[^/\\\s][^\\\s]*$/

/** `ja_JP` (the site locale code), `ja-JP`, or `ja`. */
const JAPANESE_LOCALE = /^ja(?:[-_]|$)/i

/**
 * The header text for a branded page. Japanese pages show the Japanese wordmark. Every other
 * locale shows the English one. A missing wordmark falls back to the other language, then
 * the display name.
 */
export function clinicWordmark(branding: ClinicBranding, localeCode: string): string {
    const japanese = JAPANESE_LOCALE.test(localeCode)
    const wordmark = branding.wordmark
    const preferred = japanese ? wordmark?.ja : wordmark?.en
    const other = japanese ? wordmark?.en : wordmark?.ja
    return preferred ?? other ?? branding.displayName
}

/**
 * The clinic name a patient reads on the Book and manage pages. Japanese pages show the
 * clinic site's Japanese name (the API falls back to the English one); every other locale
 * shows the English name. Patient emails follow the same rule on the server.
 */
export function patientClinicName(
    names: { clinicName: string, clinicNameJa?: string | null },
    localeCode: string
): string {
    const japanese = names.clinicNameJa?.trim() ?? ''
    return JAPANESE_LOCALE.test(localeCode) && japanese !== '' ? japanese : names.clinicName
}

/**
 * The logo src, or null to show the wordmark. Only a same-origin static path is used, so a
 * stored `//host/logo.png` or `javascript:` value never reaches an img src.
 */
export function clinicLogoSrc(branding: ClinicBranding): string | null {
    const path = branding.logoPath
    return typeof path === 'string' && LOGO_PATH.test(path) ? path : null
}
