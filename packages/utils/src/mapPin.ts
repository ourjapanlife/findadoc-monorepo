/**
 * True when a latitude and longitude can place a pin. Both must be finite, and 0 is the old
 * empty-pin value, not a clinic in Japan. The API requires one for an addressed facility, and
 * the search map leaves a facility without one off the map instead of guessing a spot.
 */
export function hasUsableMapPin(
    latitude?: number | null,
    longitude?: number | null
): boolean {
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
        return false
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false
    }
    return latitude !== 0 && longitude !== 0
}
