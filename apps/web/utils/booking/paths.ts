import { clinicLocalePrefix, clinicSubdomainUrl } from '~/utils/clinicLanding'

/** Canonical booking path on a clinic hostname. */
export function clinicBookPath(localeCode?: string | null): string {
    const prefix = clinicLocalePrefix(localeCode)
    return prefix === '' ? '/book' : `${prefix}/book`
}

/** Main-site alias that names the clinic by id or slug. */
export function bookingClinicPath(clinicIdOrSlug: string, localeCode?: string | null): string {
    const prefix = clinicLocalePrefix(localeCode)
    return `${prefix}/book/${clinicIdOrSlug}`
}

/** Absolute booking URL on the clinic subdomain. */
export function clinicBookUrl(
    slug: string,
    options: {
        localeCode?: string | null
        requestHost?: string | null
        preview?: '0' | '1'
    } = {}
): string {
    const origin = clinicSubdomainUrl(slug, {
        localeCode: options.localeCode,
        requestHost: options.requestHost
    }).replace(/\/$/, '')
    const preview = options.preview === '1' ? '?preview=1' : ''
    return `${origin}/book${preview}`
}
