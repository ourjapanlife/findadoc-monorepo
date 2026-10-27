import { DEFAULT_LOCALE_CODE, LOCALE_CODES, localeCodeFromPath, unlocalizedPath } from './localePath.ts'
import { SITE_ORIGIN } from './site.ts'

/**
 * Hosted clinic pages live in `clinic_sites`. This module only knows the URL
 * shape, the preview gate, and how every other clinic address redirects to
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
 */

export const CLINIC_LANDING_PREVIEW_COOKIE = 'online_clinic_preview'

export const CLINIC_LANDING_PREVIEW_MAX_AGE = 60 * 60 * 24 * 30

/** Site locales that carry a URL prefix. English is the unprefixed root. */
export const CLINIC_LANDING_LOCALE_PREFIXES: readonly string[] = LOCALE_CODES.filter(
    code => code !== DEFAULT_LOCALE_CODE
)

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

const LOCAL_DEV_PORT = ':3000'

/**
 * Runs in <head> before first paint. Amplify serves the same prerendered
 * `index.html` (the main homepage) on every `*.findadoc.jp` name. On a clinic
 * host that HTML is the wrong page, so this hides `#__nuxt` until `app.vue`
 * marks the clinic (or its 404) ready.
 */
export const CLINIC_HOST_BOOTSTRAP = `(function () {
  try {
    var reserved = new Set(${JSON.stringify([...RESERVED_HOST_LABELS])})
    var parents = ${JSON.stringify([...CLINIC_HOST_PARENTS])}
    var host = location.hostname.toLowerCase().split(':')[0]
    var parent
    for (var i = 0; i < parents.length; i++) {
      if (host.length > parents[i].length + 1 && host.slice(-(parents[i].length + 1)) === '.' + parents[i]) {
        parent = parents[i]
        break
      }
    }
    if (!parent) return
    var label = host.slice(0, -(parent.length + 1))
    if (!label || label.indexOf('.') !== -1 || reserved.has(label) || !/${SLUG_PATTERN.source}/.test(label)) return
    document.documentElement.setAttribute('data-clinic-host', label)
    var style = document.createElement('style')
    style.textContent = 'html[data-clinic-host]:not([data-clinic-ready]) #__nuxt{visibility:hidden}'
    document.head.appendChild(style)
  } catch (e) {}
})()`

/** Show the clinic host page after Vue has replaced the prerendered homepage. */
export function markClinicHostReady(): void {
    if (!document.documentElement.hasAttribute('data-clinic-host')) {
        return
    }
    document.documentElement.setAttribute('data-clinic-ready', '')
}

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
    if (value === 'public' || value === 'preview') {
        return value
    }
    return 'off'
}

export function clinicLandingsArePublic(value?: string | null): boolean {
    return clinicLandingMode(value ?? CLINIC_LANDING_MODE) === 'public'
}

export function clinicLandingPath(slug: string): string {
    return `/clinic/${slug}`
}

/** `''` for English, `/{code}` for every other site locale. */
export function clinicLocalePrefix(localeCode: string | null | undefined): string {
    const code = localeCode ?? DEFAULT_LOCALE_CODE
    return CLINIC_LANDING_LOCALE_PREFIXES.includes(code) ? `/${code}` : ''
}

function trimTrailingSlash(pathname: string): string {
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1'
}

/** `host:port` from a request. The port stays attached to the colon so it can be re-appended. */
function splitRequestHost(requestHost: string | null | undefined): { hostname: string, port: string } {
    const raw = (requestHost ?? '').trim().toLowerCase()
    const colon = raw.lastIndexOf(':')
    if (colon < 0) {
        return { hostname: raw, port: '' }
    }
    return { hostname: raw.slice(0, colon), port: raw.slice(colon) }
}

export type ClinicSubdomainOptions = {
    /** Site locale of the page. English and an omitted locale are the unprefixed root. */
    localeCode?: string | null
    /** The host the request arrived on, with its port. Decides local versus production. */
    requestHost?: string | null
    /** A `?query` to carry over, already prefixed with `?`. */
    query?: string
}

/**
 * The subdomain is the clinic. Local dev uses `{slug}.localhost` and keeps the
 * current port. Anywhere else, including an omitted host, is `findadoc.jp`.
 */
export function clinicSubdomainUrl(slug: string, options: ClinicSubdomainOptions = {}): string {
    const { hostname, port } = splitRequestHost(options.requestHost)
    const origin = isLocalHostname(hostname)
        ? `http://${slug}.localhost${port || LOCAL_DEV_PORT}`
        : `https://${slug}.findadoc.jp`
    const path = clinicLocalePrefix(options.localeCode) || '/'

    return `${origin}${path}${options.query ?? ''}`
}

/** Alternates for a clinic hostname. English is the unprefixed root and the x-default. */
export function clinicSubdomainHreflang(slug: string, requestHost?: string | null): Array<{
    rel: 'alternate'
    hreflang: string
    href: string
    key: string
}> {
    const alternates = [
        ...LOCALE_CODES.map(code => ({ hreflang: code, localeCode: code })),
        { hreflang: 'x-default', localeCode: DEFAULT_LOCALE_CODE }
    ]

    return alternates.map(alternate => ({
        rel: 'alternate' as const,
        hreflang: alternate.hreflang,
        href: clinicSubdomainUrl(slug, { localeCode: alternate.localeCode, requestHost }),
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

    const host = splitRequestHost(hostname).hostname
    const parent = CLINIC_HOST_PARENTS.find(item => host.endsWith(`.${item}`))
    if (parent === undefined) {
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
    return clinicLocalePrefix(localeCodeFromPath(pathname)) || '/'
}

export function isClinicHostPage(pathname: string): boolean {
    return unlocalizedPath(pathname) === '/'
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
    if (mode === 'off' || clinicLandingHostSlug(hostname) === undefined) {
        return undefined
    }

    if (isStaticHostPath(trimTrailingSlash(pathname)) || isClinicHostPage(pathname)) {
        return undefined
    }

    return clinicHostPagePath(pathname)
}

/** Absolute URL. Link previews ignore a site-relative image. */
export function clinicLandingShareImage(shareImagePath: string): string {
    return `${SITE_ORIGIN}${shareImagePath}`
}

/** The locale the URL chose, the path segments after it, and the `?query` that follows. */
export function splitClinicLandingPath(path: string): { localeCode: string, segments: string[], query: string } {
    const hashIndex = path.indexOf('#')
    const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path
    const queryIndex = withoutHash.indexOf('?')
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : ''
    const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
    return {
        localeCode: localeCodeFromPath(pathname),
        segments: unlocalizedPath(pathname).split('/').filter(Boolean),
        query
    }
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
    return slug !== undefined && SLUG_PATTERN.test(slug)
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
    const { localeCode, segments, query } = splitClinicLandingPath(path)
    if (segments[0] !== 'clinic') {
        return undefined
    }

    // `/clinic/{slug}` or `/clinic/{prefecture}/{city}/{slug}--{id}`.
    const isClinicAddress = segments.length === 2 || segments.length === 4
    const owned = isClinicAddress ? hostedSlug(segments[segments.length - 1] ?? '', sites) : undefined
    if (owned === undefined) {
        return undefined
    }
    return clinicSubdomainUrl(owned, { localeCode, requestHost, query })
}

export type ClinicLandingAccess = 'allow' | 'deny' | 'grant' | 'revoke'

export type ClinicLandingPreviewFlag = '0' | '1'

/**
 * `?preview=1` from the route or the address bar. Payload JSON can turn that
 * into a number, and a leftover cookie codec can wrap it in quotes.
 */
export function clinicLandingPreviewFlag(
    queryValue: unknown,
    search?: string | null
): ClinicLandingPreviewFlag | undefined {
    const fromQuery = asPreviewFlag(Array.isArray(queryValue) ? queryValue[0] : queryValue)
    if (fromQuery !== undefined) {
        return fromQuery
    }
    if (search === undefined || search === null || search === '') {
        return undefined
    }
    const query = search.startsWith('?') ? search.slice(1) : search
    return asPreviewFlag(new URLSearchParams(query).get('preview'))
}

function asPreviewFlag(value: unknown): ClinicLandingPreviewFlag | undefined {
    if (value === '1' || value === 1 || value === true) {
        return '1'
    }
    if (value === '0' || value === 0 || value === false) {
        return '0'
    }
    if (typeof value !== 'string') {
        return undefined
    }
    const trimmed = value.trim().replace(/^"+|"+$/g, '')
    if (trimmed === '1') {
        return '1'
    }
    if (trimmed === '0') {
        return '0'
    }
    return undefined
}

/**
 * Preview needs the cookie. `?preview=1` sets it, `?preview=0` clears it.
 * Public does not look at the cookie. Off is a 404.
 */
export function clinicLandingAccess(
    mode: ClinicLandingMode,
    previewQuery: unknown,
    cookieValue: unknown
): ClinicLandingAccess {
    if (mode === 'off') {
        return 'deny'
    }
    if (mode === 'public') {
        return 'allow'
    }
    const preview = clinicLandingPreviewFlag(previewQuery)
    if (preview === '0') {
        return 'revoke'
    }
    if (preview === '1') {
        return 'grant'
    }
    if (asPreviewFlag(cookieValue) === '1') {
        return 'allow'
    }
    return 'deny'
}

/**
 * A clinic hostname serves the homepage HTML. That payload has no clinic row,
 * so the browser must fetch. A public `/clinic/{slug}` page can use generate.
 */
export function clinicSiteFetchIsServer(
    mode: ClinicLandingMode,
    hostname: string | null | undefined
): boolean {
    return mode === 'public' && clinicLandingHostSlug(hostname) === undefined
}
