import { SITE_ORIGIN } from './site.ts'

/**
 * Hosted clinic pages live in `clinic_sites`. This module only knows the URL
 * shape, the preview cookie, and how a directory address redirects to the clean link.
 *
 * The link to advertise is `/clinic/{slug}`. A directory address that ends in
 * the same slug, or in `--{facilityId}`, redirects here. The clinic row is what
 * an account and a future CRM attach to. `facility_id` on that row stays empty
 * until the directory listing exists.
 *
 * `NUXT_PUBLIC_ONLINE_CLINIC`:
 * - unset in `pnpm dev` — same as `preview`, so `turbo dev` does not need the variable
 * - unset for generate and Netlify — every landing is a 404, and the id address stays a clinic URL
 * - `off` — the 404, including in dev
 * - `preview` — showcase. `?preview=1` sets a cookie; without it the landing is a 404,
 *   noindex, and absent from the sitemap. The id address still redirects to the clean link
 * - `public` — a published clinic is prerendered, indexable, and listed in the sitemap.
 *   A clinic still in `preview` keeps the cookie.
 *
 * Booking buttons do not go anywhere yet. The appointment flow replaces them later.
 *
 * Locale prefixes are listed here so the Netlify edge function does not import i18n.
 * `clinicLanding.spec.ts` checks them against `LOCALE_CODES`.
 */

export const CLINIC_LANDING_PREVIEW_COOKIE = 'online_clinic_preview'

export const CLINIC_LANDING_PREVIEW_MAX_AGE = 60 * 60 * 24 * 30

export const CLINIC_LANDING_LOCALE_PREFIXES = [
    'ja-JP',
    'zh-CN',
    'vi-VN',
    'ko-KR',
    'tl-PH',
    'pt-BR',
    'fr-FR',
    'ru-RU',
    'de-DE',
    'it-IT'
] as const

const ID_SEPARATOR = '--'

/** Same shape the database accepts. Keeps the Nuxt file route `/clinic/[slug]` an entity path. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Names that already belong to another service. `admin` is held for the staff
 * site that will manage every clinic. A clinic slug cannot use one of these.
 */
const RESERVED_HOST_LABELS = new Set([
    'www',
    'api',
    'mcp',
    'docs',
    'admin',
    'mail',
    'app',
    'localhost'
])

const CLINIC_HOST_PARENTS = ['localhost', 'findadoc.jp'] as const

/** A hosted clinic the API already decided is preview or published. */
export type HostedClinicRef = {
    slug: string
    facilityId?: string | null
    status?: string | null
    shareImagePath?: string | null
}

export type ClinicLandingMode = 'off' | 'preview' | 'public'

export function clinicLandingMode(value: string | null | undefined): ClinicLandingMode {
    if (value === 'public') {
        return 'public'
    }
    if (value === 'preview' || value === 'true') {
        return 'preview'
    }
    return 'off'
}

/**
 * A set flag always wins, including `off`.
 * `pnpm dev` uses preview when the variable is missing.
 * Generate and Netlify pass `isDev` false, so they stay off until the variable is set.
 */
export function hostedPreviewValue(value: string | null | undefined, isDev: boolean): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
        return value
    }
    return isDev ? 'preview' : undefined
}

export function clinicLandingsArePublic(value?: string | null): boolean {
    return clinicLandingMode(value ?? process.env.NUXT_PUBLIC_ONLINE_CLINIC) === 'public'
}

export function clinicLandingPath(slug: string): string {
    return `/clinic/${slug}`
}

/**
 * `{slug}.localhost` and `{slug}.findadoc.jp` name a clinic. The apex and the
 * reserved labels do not. A port on the host is ignored.
 */
export function clinicLandingHostSlug(hostname: string | null | undefined): string | undefined {
    if (!hostname) {
        return undefined
    }

    const host = hostname.toLowerCase().split(':')[0] ?? ''
    const parent = CLINIC_HOST_PARENTS.find(item => host.endsWith(`.${item}`))
    if (!parent) {
        return undefined
    }

    const label = host.slice(0, -(parent.length + 1))
    if (!label || label.includes('.') || RESERVED_HOST_LABELS.has(label) || !SLUG_PATTERN.test(label)) {
        return undefined
    }

    return label
}

/** Scripts, images, and Vite files stay on the host. A page path does not. */
export function isStaticHostPath(pathname: string): boolean {
    if (pathname.startsWith('/_nuxt') || pathname.startsWith('/__nuxt') || pathname.startsWith('/@')) {
        return true
    }
    const leaf = pathname.split('/').pop() ?? ''
    return leaf.includes('.')
}

/** `/` or `/{locale}` on a clinic hostname. The clinic path is not part of this URL. */
export function clinicHostPagePath(pathname: string): string {
    const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    const locale = trimmed.split('/').filter(Boolean)[0]
    if (locale && (CLINIC_LANDING_LOCALE_PREFIXES as readonly string[]).includes(locale)) {
        return `/${locale}`
    }
    return '/'
}

export function isClinicHostPage(pathname: string): boolean {
    const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    return trimmed === clinicHostPagePath(pathname)
}

/**
 * A clinic hostname is the clinic. `/` stays `/`. `/submit` and `/clinic/{slug}`
 * on that host go back to `/` (or `/{locale}`). Files the page loads stay put.
 * Off mode does not redirect.
 */
export function clinicHostLandingTarget(
    hostname: string | null | undefined,
    pathname: string,
    mode: ClinicLandingMode
): string | undefined {
    if (mode === 'off') {
        return undefined
    }

    if (!clinicLandingHostSlug(hostname)) {
        return undefined
    }

    const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    if (isStaticHostPath(trimmed) || isClinicHostPage(pathname)) {
        return undefined
    }

    return clinicHostPagePath(pathname)
}

/** Absolute URL. Link previews ignore a site-relative image. */
export function clinicLandingShareImage(shareImagePath: string): string {
    return `${SITE_ORIGIN}${shareImagePath}`
}

export function splitClinicLandingPath(path: string): { localePrefix: string, segments: string[], query: string } {
    const hashIndex = path.indexOf('#')
    const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path
    const queryIndex = withoutHash.indexOf('?')
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : ''
    const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
    const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    const segments = trimmed.split('/').filter(Boolean)
    let localePrefix = ''
    const first = segments[0]
    if (first && (CLINIC_LANDING_LOCALE_PREFIXES as readonly string[]).includes(first)) {
        localePrefix = `/${segments.shift()}`
    }
    return { localePrefix, segments, query }
}

function hostedSlug(segment: string, sites: readonly HostedClinicRef[]): string | undefined {
    const separator = segment.lastIndexOf(ID_SEPARATOR)
    const slug = (separator >= 0 ? segment.slice(0, separator) : segment).trim()
    const facilityId = separator >= 0 ? segment.slice(separator + ID_SEPARATOR.length) : undefined
    const bySlug = sites.find(site => site.slug === slug)
    if (bySlug) {
        return bySlug.slug
    }
    if (!facilityId) {
        return undefined
    }
    return sites.find(site => site.facilityId === facilityId)?.slug
}

/**
 * `/clinic/{slug}` with no id. The API still decides whether that slug is a clinic.
 * Directory clinics are `/clinic/{prefecture}/{city}/{slug}`.
 */
export function isClinicLandingPath(path: string): boolean {
    const { segments } = splitClinicLandingPath(path)
    if (segments.length !== 2 || segments[0] !== 'clinic') {
        return false
    }
    const slug = segments[1]
    return !!slug && SLUG_PATTERN.test(slug)
}

/**
 * Directory URL for a clinic that owns a landing → the clean link.
 * `/clinic/tokyo/minato/multilingual-online-clinic--{id}` and the same path
 * without an id both come here. The clean link itself does not.
 * Off mode does not redirect, so a normal clinic page can still be served.
 */
export function clinicLandingRedirectTarget(
    path: string,
    mode: ClinicLandingMode,
    sites: readonly HostedClinicRef[]
): string | undefined {
    if (mode === 'off') {
        return undefined
    }
    const { localePrefix, segments, query } = splitClinicLandingPath(path)
    if (segments[0] !== 'clinic') {
        return undefined
    }

    let owned: string | undefined
    if (segments.length === 4) {
        owned = hostedSlug(segments[3] ?? '', sites)
    } else if (segments.length === 2 && (segments[1] ?? '').includes(ID_SEPARATOR)) {
        owned = hostedSlug(segments[1] ?? '', sites)
    }
    if (!owned) {
        return undefined
    }
    return `${localePrefix}${clinicLandingPath(owned)}${query}`
}

export type ClinicLandingAccess = 'allow' | 'deny' | 'grant' | 'revoke'

/**
 * Preview needs the cookie. `?preview=1` sets it, `?preview=0` clears it.
 * Public does not look at the cookie. Off is a 404.
 */
export function clinicLandingAccess(
    mode: ClinicLandingMode,
    previewQuery: string | null | undefined,
    cookieValue: string | null | undefined
): ClinicLandingAccess {
    if (mode === 'off') {
        return 'deny'
    }
    if (mode === 'public') {
        return 'allow'
    }
    if (previewQuery === '0') {
        return 'revoke'
    }
    if (previewQuery === '1') {
        return 'grant'
    }
    if (cookieValue === '1') {
        return 'allow'
    }
    return 'deny'
}

export function clinicLandingPreviewCookie(header: string | null | undefined): string | undefined {
    if (!header) {
        return undefined
    }
    for (const part of header.split(';')) {
        const trimmed = part.trim()
        const splitAt = trimmed.indexOf('=')
        if (splitAt < 0) {
            continue
        }
        if (trimmed.slice(0, splitAt) === CLINIC_LANDING_PREVIEW_COOKIE) {
            return trimmed.slice(splitAt + 1)
        }
    }
    return undefined
}

export function clinicLandingPreviewCookieHeader(secure: boolean, clear = false): string {
    const value = clear ? '' : '1'
    const age = clear ? 0 : CLINIC_LANDING_PREVIEW_MAX_AGE
    const secureFlag = secure ? '; Secure' : ''
    return `${CLINIC_LANDING_PREVIEW_COOKIE}=${value}; Path=/; Max-Age=${age}; SameSite=Lax${secureFlag}`
}
