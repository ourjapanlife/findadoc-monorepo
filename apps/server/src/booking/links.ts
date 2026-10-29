import { createHash, randomBytes } from 'node:crypto'
import { envVariables } from '../../utils/environmentVariables.js'

/**
 * Links that booking emails carry.
 *
 * The patient token sits in the URL fragment, so it never reaches a server or
 * CDN access log. Only its sha256 is stored (booking_submissions.cancel_token_hash).
 */

const PRODUCTION_SITE_ORIGIN = 'https://www.findadoc.jp'
const LOCAL_SITE_ORIGIN = 'http://localhost:3000'
const DEFAULT_LOCALE = 'en-US'

/** WEBSITE_URL when it is an absolute http(s) origin. The dev file sets it to the API host, so fall back. */
export function siteOrigin(): string {
    const configured = (envVariables.websiteURL() ?? '').trim().replace(/\/+$/, '')
    if (/^https?:\/\//.test(configured)) {
        return configured
    }
    return envVariables.isProduction() ? PRODUCTION_SITE_ORIGIN : LOCAL_SITE_ORIGIN
}

function localePrefix(locale: string): string {
    return locale === DEFAULT_LOCALE ? '' : `/${locale}`
}

export function newPatientToken(): { token: string, hash: string } {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: hashPatientToken(token) }
}

export function hashPatientToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex')
}

export function patientBookingUrl(token: string, locale: string): string {
    return `${siteOrigin()}${localePrefix(locale)}/book/manage#${token}`
}

export function clinicDashboardUrl(facilityId: string): string {
    return `${siteOrigin()}/clinic-dashboard/${facilityId}`
}
