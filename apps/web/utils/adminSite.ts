import { CLINIC_LANDING_LOCALE_PREFIXES, isStaticHostPath, type ClinicLandingMode } from './clinicLanding.ts'

/**
 * `admin.findadoc.jp` and `admin.localhost` are the staff site.
 * There is no environment variable. `?preview=1` sets the cookie.
 * The page stays noindex. Assigning a person still requires a staff login or a hospital owner.
 */

/** Cookie gate for every deploy. The staff page stays noindex even if this becomes `public`. */
export const ADMIN_SITE_MODE: ClinicLandingMode = 'preview'

export const ADMIN_SITE_PREVIEW_COOKIE = 'admin_site_preview'

export const ADMIN_SITE_PREVIEW_MAX_AGE = 60 * 60 * 24 * 30

export const ADMIN_SITE_PATH = '/admin'

const ADMIN_HOSTS = new Set(['admin.localhost', 'admin.findadoc.jp'])

export type AdminSiteAccess = 'allow' | 'deny' | 'grant' | 'revoke'

export function adminSiteMode(value: string | null | undefined): ClinicLandingMode {
    if (value === 'public') {
        return 'public'
    }
    if (value === 'preview' || value === 'true') {
        return 'preview'
    }
    return 'off'
}

export function isAdminHost(hostname: string | null | undefined): boolean {
    if (!hostname) {
        return false
    }
    const host = hostname.toLowerCase().split(':')[0] ?? ''
    return ADMIN_HOSTS.has(host)
}

export function isAdminPath(path: string): boolean {
    const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
    const segments = trimmed.split('/').filter(Boolean)
    if (segments.length === 1) {
        return segments[0] === 'admin'
    }
    if (segments.length === 2) {
        const locale = segments[0]
        return segments[1] === 'admin'
          && !!locale
          && (CLINIC_LANDING_LOCALE_PREFIXES as readonly string[]).includes(locale)
    }
    return false
}

/**
 * The admin hostname opens `/admin`. Other pages, including `/submit`, go there too.
 * The admin path itself, and files the page loads, stay put. Off mode does not redirect.
 */
export function adminHostTarget(
    hostname: string | null | undefined,
    pathname: string,
    mode: ClinicLandingMode
): string | undefined {
    if (mode === 'off' || !isAdminHost(hostname)) {
        return undefined
    }

    const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    if (isStaticHostPath(trimmed)) {
        return undefined
    }

    const segments = trimmed.split('/').filter(Boolean)
    const locale = segments[0]
    const target = locale && (CLINIC_LANDING_LOCALE_PREFIXES as readonly string[]).includes(locale)
        ? `/${locale}${ADMIN_SITE_PATH}`
        : ADMIN_SITE_PATH
    if (trimmed === target) {
        return undefined
    }

    return target
}

export function adminSiteAccess(
    mode: ClinicLandingMode,
    previewQuery: string | null | undefined,
    cookieValue: string | null | undefined
): AdminSiteAccess {
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

export function adminSitePreviewCookie(header: string | null | undefined): string | undefined {
    if (!header) {
        return undefined
    }
    for (const part of header.split(';')) {
        const trimmed = part.trim()
        const splitAt = trimmed.indexOf('=')
        if (splitAt < 0) {
            continue
        }
        if (trimmed.slice(0, splitAt) === ADMIN_SITE_PREVIEW_COOKIE) {
            return trimmed.slice(splitAt + 1)
        }
    }
    return undefined
}

export function adminSitePreviewCookieHeader(secure: boolean, clear = false): string {
    const value = clear ? '' : '1'
    const age = clear ? 0 : ADMIN_SITE_PREVIEW_MAX_AGE
    const secureFlag = secure ? '; Secure' : ''
    return `${ADMIN_SITE_PREVIEW_COOKIE}=${value}; Path=/; Max-Age=${age}; SameSite=Lax${secureFlag}`
}
