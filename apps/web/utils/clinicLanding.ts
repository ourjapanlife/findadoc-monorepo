import { SITE_ORIGIN } from './site.ts'

/**
 * Hosted clinic pages live in `clinic_sites`. This module only knows the URL
 * shape, the preview cookie, and how every other clinic address redirects to
 * the subdomain.
 *
 * The address to share is `https://{slug}.findadoc.jp/`. `/clinic/{slug}`, the
 * directory breadcrumb, and `/clinic/{prefecture}/{city}/{slug}--{id}` redirect
 * there. The clinic row is what an account and a future CRM attach to.
 * `facility_id` on the showcase row is the directory listing in the seed.
 *
 * There is no environment variable. `CLINIC_LANDING_MODE` is `preview`:
 * `?preview=1` sets a cookie; without it the landing is a 404, noindex, and absent
 * from the sitemap. The id address still redirects to the subdomain.
 * `public` is the later value that prerenders and indexes a published clinic.
 *
 * Booking buttons do not go anywhere yet. The appointment flow replaces them later.
 *
 * Locale prefixes are listed here so host redirects share one list.
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

/** Cookie gate for every deploy. Change this to `public` when search should index the clinic. */
export const CLINIC_LANDING_MODE: ClinicLandingMode = 'preview'

/**
 * Slugs generate copies into `{path}.html` so an Amplify preview can open them.
 * Keep this equal to `clinicSiteSeeds`. A public build prerenders the page and
 * does not use the copy.
 */
export const CLINIC_PREVIEW_SHELL_SLUGS = ['multilingual-online-clinic'] as const

export function clinicLandingMode(value: string | null | undefined): ClinicLandingMode {
    if (value === 'public') {
        return 'public'
    }
    if (value === 'preview' || value === 'true') {
        return 'preview'
    }
    return 'off'
}

export function clinicLandingsArePublic(value?: string | null): boolean {
    return clinicLandingMode(value ?? CLINIC_LANDING_MODE) === 'public'
}

export function clinicLandingPath(slug: string): string {
    return `/clinic/${slug}`
}

/**
 * The subdomain is the clinic. Local dev uses `{slug}.localhost` and keeps the
 * current port. Anywhere else, including an omitted host, is `findadoc.jp`.
 */
export function clinicSubdomainUrl(
    slug: string,
    localePrefix = '',
    requestHost?: string | null,
    query = ''
): string {
    const raw = (requestHost ?? '').trim().toLowerCase()
    const hostname = raw.split(':')[0] ?? ''
    const port = raw.includes(':') ? raw.slice(raw.indexOf(':')) : ''
    const local = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1'
    const origin = local
        ? `http://${slug}.localhost${port || ':3000'}`
        : `https://${slug}.findadoc.jp`
    const path = localePrefix.length > 0 ? localePrefix : '/'

    return `${origin}${path}${query}`
}

/** Alternates for a clinic hostname. English is the unprefixed root. */
export function clinicSubdomainHreflang(slug: string, requestHost?: string | null): Array<{
    rel: 'alternate'
    hreflang: string
    href: string
    key: string
}> {
    const alternates = [
        { hreflang: 'en-US', href: clinicSubdomainUrl(slug, '', requestHost) },
        ...CLINIC_LANDING_LOCALE_PREFIXES.map(code => ({
            hreflang: code,
            href: clinicSubdomainUrl(slug, `/${code}`, requestHost)
        })),
        { hreflang: 'x-default', href: clinicSubdomainUrl(slug, '', requestHost) }
    ]

    return alternates.map(alternate => ({
        rel: 'alternate' as const,
        hreflang: alternate.hreflang,
        href: alternate.href,
        key: `hreflang-${alternate.hreflang}`
    }))
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
    if (pathname.startsWith('/_nuxt') || pathname.startsWith('/__nuxt') || pathname.startsWith('/@')
      || pathname.startsWith('/api/')) {
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
    if (!facilityId) {
        return bySlug?.slug
    }
    if (bySlug?.facilityId === facilityId) {
        return bySlug.slug
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
 * A hosted clinic's breadcrumb, clean path, and shareable `--{id}` address
 * all go to `{slug}.findadoc.jp`. A directory clinic that is not one of those
 * rows stays on its own page. Off mode does not redirect.
 */
export function clinicLandingRedirectTarget(
    path: string,
    mode: ClinicLandingMode,
    sites: readonly HostedClinicRef[],
    requestHost?: string | null
): string | undefined {
    if (mode === 'off') {
        return undefined
    }
    const { localePrefix, segments, query } = splitClinicLandingPath(path)
    if (segments[0] !== 'clinic') {
        return undefined
    }

    let owned: string | undefined
    if (segments.length === 4 || segments.length === 2) {
        owned = hostedSlug(segments[segments.length - 1] ?? '', sites)
    }
    if (!owned) {
        return undefined
    }
    return clinicSubdomainUrl(owned, localePrefix, requestHost, query)
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
