/* eslint-disable camelcase -- Google consent mode field names (ad_storage, ad_user_data). */
/**
 * Google tag (Ads, and Analytics when it is on) behind explicit consent.
 *
 * Nothing is sent to Google until the visitor accepts:
 * - The <head> bootstrap only sets every consent signal to denied. It does not
 *   load gtag.js, so there is no request and no cookieless ping before consent.
 * - Accept stores the choice, grants consent, then loads gtag.js. The consent
 *   update is queued before `js` and `config`, so the first hit is granted.
 * - A returning visitor who accepted gets the same sequence on page load.
 * - Decline stores the choice and deletes Google's cookies. If the tag was
 *   already running, the page reloads so gtag.js is gone.
 * - Ad personalization is never granted. Find a Doc is a health directory, and
 *   Google does not allow remarketing on health browsing.
 */

export type ConsentChoice = 'granted' | 'denied'

export const CONSENT_COOKIE = 'fad_consent'
/** `#cookie-settings` opens the banner, so the footer link works before hydration. */
export const CONSENT_SETTINGS_HASH = 'cookie-settings'
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60
export const GOOGLE_TAG_URL = 'https://www.googletagmanager.com/gtag/js'
/** e2e only (testing mode): tag ids from localStorage, so the dev server can exercise loading. */
export const E2E_GOOGLE_TAG_IDS_KEY = 'findadoc.e2e.googleTagIds'

/** Cookies Google Ads and Analytics set on our domain. */
const GOOGLE_COOKIE_PATTERN = /^(_ga|_gid|_gat|_gcl_)/

type TagWindow = Window & { dataLayer?: unknown[], gtag?: (...args: unknown[]) => void }

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

function sharedDomain(hostname: string): string | undefined {
    const host = hostname.toLowerCase()
    return host === 'findadoc.jp' || host.endsWith('.findadoc.jp') ? '.findadoc.jp' : undefined
}

/** `fad_consent=…` for document.cookie. On findadoc.jp hosts it is shared with clinic subdomains. */
export function consentCookie(choice: ConsentChoice, hostname: string, secure: boolean): string {
    const parts = [
        `${CONSENT_COOKIE}=${choice}`,
        'Path=/',
        `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
        'SameSite=Lax'
    ]
    const domain = sharedDomain(hostname)
    if (domain !== undefined) {
        parts.push(`Domain=${domain}`)
    }
    if (secure) {
        parts.push('Secure')
    }
    return parts.join('; ')
}

/**
 * Inline in <head>, before any app code: every signal denied. It never loads
 * gtag.js. Uses `arguments`, as gtag.js requires.
 */
export function consentBootstrapScript(): string {
    return `(function () {
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments) }
  window.gtag('consent', 'default', ${JSON.stringify(consentSignals('denied'))})
  window.gtag('set', 'ads_data_redaction', true)
})()`
}

function tagFunction(win: TagWindow): (...args: unknown[]) => void {
    win.dataLayer = win.dataLayer ?? []
    if (win.gtag === undefined) {
        const dataLayer = win.dataLayer
        win.gtag = function() {
            // eslint-disable-next-line prefer-rest-params -- gtag.js reads Arguments objects, not arrays.
            dataLayer.push(arguments)
        }
    }
    return win.gtag
}

export function isGoogleTagLoaded(doc: Document): boolean {
    return doc.querySelector('script[data-google-tag]') !== null
}

/** Queues `js` and `config`, then adds gtag.js once. Call only after consent is granted. */
export function loadGoogleTag(tagIds: readonly string[], win: TagWindow, doc: Document): void {
    if (tagIds.length === 0 || isGoogleTagLoaded(doc)) {
        return
    }
    const gtag = tagFunction(win)
    gtag('js', new Date())
    for (const id of tagIds) {
        gtag('config', id)
    }
    const script = doc.createElement('script')
    script.async = true
    script.src = `${GOOGLE_TAG_URL}?id=${encodeURIComponent(tagIds[0]!)}`
    script.setAttribute('data-google-tag', '')
    doc.head.appendChild(script)
}

/** Expires Google's cookies on this host and on the shared findadoc.jp domain. */
export function clearGoogleCookies(doc: Document, hostname: string): void {
    const domain = sharedDomain(hostname)
    for (const pair of doc.cookie.split(';')) {
        const name = pair.split('=')[0]?.trim() ?? ''
        if (!GOOGLE_COOKIE_PATTERN.test(name)) {
            continue
        }
        doc.cookie = `${name}=; Path=/; Max-Age=0`
        if (domain !== undefined) {
            doc.cookie = `${name}=; Path=/; Max-Age=0; Domain=${domain}`
        }
    }
}

/** Accept: store the choice, grant consent, then load the tag. */
export function grantConsent(tagIds: readonly string[], win: TagWindow, doc: Document): void {
    doc.cookie = consentCookie('granted', win.location.hostname, win.location.protocol === 'https:')
    tagFunction(win)('consent', 'update', consentSignals('granted'))
    loadGoogleTag(tagIds, win, doc)
}

/** Decline: store the choice, deny consent, delete Google's cookies, and drop a running tag. */
export function denyConsent(win: TagWindow, doc: Document): void {
    const wasLoaded = isGoogleTagLoaded(doc)
    doc.cookie = consentCookie('denied', win.location.hostname, win.location.protocol === 'https:')
    tagFunction(win)('consent', 'update', consentSignals('denied'))
    clearGoogleCookies(doc, win.location.hostname)
    if (wasLoaded) {
        // gtag.js cannot be unloaded. A reload starts the page without it.
        win.location.reload()
    }
}

/** Page load: a stored Accept loads the tag. Returns the stored choice. */
export function restoreConsent(tagIds: readonly string[], win: TagWindow, doc: Document): ConsentChoice | undefined {
    const choice = parseConsentCookie(doc.cookie)
    if (choice === 'granted') {
        tagFunction(win)('consent', 'update', consentSignals('granted'))
        loadGoogleTag(tagIds, win, doc)
    }
    return choice
}
