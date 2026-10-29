/* eslint-disable camelcase -- Google consent mode field names (ad_storage, wait_for_update). */
/**
 * Google consent mode for the Google tag (Ads, and Analytics when it is on).
 *
 * - Ad personalization is always denied. Find a Doc is a health directory, and
 *   Google does not allow remarketing on health browsing.
 * - Visitors in the EEA, the UK, and Switzerland start denied until they accept.
 *   Google applies that region default from its own geolocation.
 * - Everyone else starts granted for measurement. The privacy policy names the
 *   tags (Japan's external-transmission rule asks for notice, not opt-in).
 * - A choice is stored in a first-party cookie for 180 days, shared with clinic
 *   subdomains, and replayed in <head> before the tag sends anything.
 */

export type ConsentChoice = 'granted' | 'denied'

export const CONSENT_COOKIE = 'fad_consent'
/** `#cookie-settings` opens the banner, so the footer link works before hydration. */
export const CONSENT_SETTINGS_HASH = 'cookie-settings'
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

/** EEA, UK, and Switzerland as ISO 3166-1 alpha-2 codes. */
export const CONSENT_REQUIRED_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
    'GB', 'CH'
] as const

/** Consent signals for a choice. Personalization never follows the choice. */
export function consentSignals(choice: ConsentChoice) {
    return {
        ad_storage: choice,
        ad_user_data: choice,
        analytics_storage: choice,
        ad_personalization: 'denied' as const
    }
}

export function parseConsentCookie(cookieHeader: string): ConsentChoice | undefined {
    const match = new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(granted|denied)(?:;|$)`).exec(cookieHeader)
    return match?.[1] as ConsentChoice | undefined
}

/** `fad_consent=…` for document.cookie. On findadoc.jp hosts it is shared with clinic subdomains. */
export function consentCookie(choice: ConsentChoice, hostname: string, secure: boolean): string {
    const parts = [
        `${CONSENT_COOKIE}=${choice}`,
        'Path=/',
        `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
        'SameSite=Lax'
    ]
    const host = hostname.toLowerCase()
    if (host === 'findadoc.jp' || host.endsWith('.findadoc.jp')) {
        parts.push('Domain=.findadoc.jp')
    }
    if (secure) {
        parts.push('Secure')
    }
    return parts.join('; ')
}

const EUROPEAN_ATLANTIC_ZONES = new Set([
    'Atlantic/Reykjavik',
    'Atlantic/Canary',
    'Atlantic/Madeira',
    'Atlantic/Azores',
    'Atlantic/Faroe',
    'Arctic/Longyearbyen'
])

/**
 * Whether to show the banner without being asked. The site is static, so the
 * browser time zone stands in for the visitor's country. A miss is safe: Google
 * still applies the denied region default, and the footer link opens the banner.
 */
export function isConsentRegionTimeZone(timeZone: string | undefined): boolean {
    if (!timeZone) {
        return false
    }
    return timeZone.startsWith('Europe/') || EUROPEAN_ATLANTIC_ZONES.has(timeZone)
}

/**
 * Runs inline in <head>, before nuxt-gtag pushes `js` and `config`, so the first
 * page view already carries consent. Uses `arguments`, as gtag.js requires.
 */
export function consentBootstrapScript(): string {
    const denied = JSON.stringify({
        ...consentSignals('denied'),
        region: CONSENT_REQUIRED_REGIONS,
        wait_for_update: 500
    })
    const granted = JSON.stringify(consentSignals('granted'))
    return `(function () {
  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  gtag('consent', 'default', ${denied})
  gtag('consent', 'default', ${granted})
  gtag('set', 'ads_data_redaction', true)
  try {
    var m = document.cookie.match(/(?:^|;\\s*)${CONSENT_COOKIE}=(granted|denied)(?:;|$)/)
    if (m) gtag('consent', 'update', { ad_storage: m[1], ad_user_data: m[1], analytics_storage: m[1], ad_personalization: 'denied' })
  } catch (e) {}
})()`
}
