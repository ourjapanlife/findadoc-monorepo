import { clinicLandingPreviewFlag, clinicLocalePrefix } from '~/utils/clinicLanding'
import { SITE_ORIGIN } from '~/utils/site'
import { bookingQueryString, parseBookingQuery, type BookingQuery } from './query'

function splitRequestHost(requestHost: string | null | undefined): { hostname: string, port: string } {
    const raw = (requestHost ?? '').trim().toLowerCase()
    const colon = raw.lastIndexOf(':')
    if (colon < 0) {
        return { hostname: raw, port: '' }
    }
    return { hostname: raw.slice(0, colon), port: raw.slice(colon) }
}

function isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1'
}

/** Find a Doc origin. Clinic hosts bounce Book here. */
export function findadocOrigin(requestHost?: string | null): string {
    const { hostname, port } = splitRequestHost(requestHost)
    if (isLocalHostname(hostname)) {
        return `http://localhost${port || ':3000'}`
    }
    return SITE_ORIGIN
}

export function bookingClinicPath(
    clinicId: string,
    localeCode?: string | null,
    query: BookingQuery = {}
): string {
    const prefix = clinicLocalePrefix(localeCode)
    const search = bookingQueryString(query)
    return `${prefix}/book/${clinicId}${search}`
}

/** Absolute Book URL on the Find a Doc site, never a clinic subdomain. */
export function findadocBookUrl(
    clinicId: string,
    options: {
        localeCode?: string | null
        requestHost?: string | null
        query?: BookingQuery
        preview?: '0' | '1'
    } = {}
): string {
    const origin = findadocOrigin(options.requestHost)
    const search = bookingQueryString(options.query ?? {}, options.preview)
    const prefix = clinicLocalePrefix(options.localeCode)
    return `${origin}${prefix}/book/${clinicId}${search}`
}

export function bookingQueryFromRoute(query: Record<string, unknown>): BookingQuery {
    return parseBookingQuery(query)
}

export function bookingPreviewFromRoute(query: Record<string, unknown>): '0' | '1' | undefined {
    return clinicLandingPreviewFlag(query.preview)
}
