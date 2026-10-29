import { describe, expect, it } from 'vitest'
import { GraphQLError } from 'graphql'
import {
    assertBookingRegion,
    BOOKING_REGION_UNAVAILABLE,
    bookingRegionEnforced,
    isBookingAvailableIn
} from '../src/booking/region.js'
import { isServerError } from '../src/requestErrors.js'

function refusal(viewerCountry: string | undefined): GraphQLError | undefined {
    try {
        assertBookingRegion(viewerCountry, true)
        return undefined
    } catch (error) {
        return error as GraphQLError
    }
}

describe('booking region (#173)', () => {
    it('accepts a viewer in Japan in production mode', () => {
        expect(isBookingAvailableIn('JP', true)).toBe(true)
        expect(refusal('JP')).toBeUndefined()
    })

    it('refuses other countries and a missing country in production mode', () => {
        for (const country of ['DE', 'GB', 'CH', 'US', undefined]) {
            expect(isBookingAvailableIn(country, true)).toBe(false)
            const error = refusal(country)
            expect(error?.extensions.code).toBe(BOOKING_REGION_UNAVAILABLE)
            // The visitor's location, not a server fault: no Sentry alert.
            expect(isServerError(error!)).toBe(false)
        }
    })

    it('skips the check in local development and tests', () => {
        expect(bookingRegionEnforced()).toBe(false)
        expect(isBookingAvailableIn(undefined)).toBe(true)
        expect(() => assertBookingRegion('DE')).not.toThrow()
    })
})
