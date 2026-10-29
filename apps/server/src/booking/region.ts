import { GraphQLError } from 'graphql'
import { envVariables } from '../../utils/environmentVariables.js'

/**
 * Booking is offered only to people who are in Japan now (#173).
 *
 * A booking request carries health information and identity documents. From the EEA, the UK,
 * or Switzerland that would bring in the GDPR's rules for special-category data, so booking stays
 * under the APPI by serving visitors in Japan only. The directory, search, clinic pages, and the
 * patient's manage link stay open everywhere.
 *
 * The country is CloudFront's CloudFront-Viewer-Country, trusted only with the edge secret
 * (viewerCountryFrom in @findadoc/utils). A missing country is refused. Local development and
 * tests have no CloudFront in front, so they skip the check. A VPN can change the country, so
 * the Book page also asks the visitor to confirm they are in Japan.
 */
export const BOOKING_COUNTRY = 'JP'

export const BOOKING_REGION_UNAVAILABLE = 'BOOKING_REGION_UNAVAILABLE'

/** Whether this API checks the viewer's country. Production only, and never under tests. */
export function bookingRegionEnforced(): boolean {
    return envVariables.isProduction() && !envVariables.isTestingEnvironment()
}

export function isBookingAvailableIn(
    viewerCountry: string | undefined,
    enforced: boolean = bookingRegionEnforced()
): boolean {
    return !enforced || viewerCountry === BOOKING_COUNTRY
}

/** Refuses a booking call from outside Japan with its own error code, not a validation error. */
export function assertBookingRegion(
    viewerCountry: string | undefined,
    enforced: boolean = bookingRegionEnforced()
): void {
    if (isBookingAvailableIn(viewerCountry, enforced)) {
        return
    }
    throw new GraphQLError('Booking is only available to people in Japan', {
        extensions: { code: BOOKING_REGION_UNAVAILABLE, http: { status: 403 } }
    })
}
