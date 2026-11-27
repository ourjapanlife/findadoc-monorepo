import { distanceMeters, hasUsableMapPin, type GeoPoint } from '@findadoc/utils'
import type { FacilitySearchResult } from '~/utils/searchDirectory'

/** The one sort `/search` offers besides directory order. `?sort=near` in the URL. */
export const NEAR_ME_SORT = 'near'
export type SearchSort = typeof NEAR_ME_SORT

export function isSearchSort(value: unknown): value is SearchSort {
    return value === NEAR_ME_SORT
}

/**
 * Results nearest first, each carrying its straight-line distance from `origin`.
 *
 * `origin` is the visitor's position. It is used here, on their device, and nowhere else: it is
 * not sent to the API, stored, put in the URL, or tracked. A facility with no pin (an online
 * clinic) has no distance and goes after every one that has, in directory order. Ties keep
 * directory order, so a facility with a matching doctor stays ahead at the same spot.
 */
export function sortByDistance(
    results: readonly FacilitySearchResult[],
    origin: GeoPoint
): FacilitySearchResult[] {
    const measured: FacilitySearchResult[] = []
    const unplaced: FacilitySearchResult[] = []

    for (const result of results) {
        const { mapLatitude: latitude, mapLongitude: longitude } = result
        if (hasUsableMapPin(latitude, longitude)) {
            measured.push({
                ...result,
                distanceMeters: distanceMeters(origin, { latitude: latitude as number, longitude: longitude as number })
            })
        } else {
            unplaced.push(result)
        }
    }

    // Array.prototype.sort is stable, so equal distances keep directory order.
    measured.sort((left, right) => (left.distanceMeters ?? 0) - (right.distanceMeters ?? 0))

    return [...measured, ...unplaced]
}

/**
 * A distance as people read it, in the page's language: "350 m", "1.2 km", "48 km".
 *
 * Rounded so it does not claim a precision a browser position and a straight line do not have.
 * Under 1 km it rounds to 50 m (never below 50 m), under 10 km to 0.1 km, and to whole km above.
 */
export function formatDistance(meters: number, locale: string): string {
    if (meters < 1_000) {
        const rounded = Math.max(50, Math.round(meters / 50) * 50)
        if (rounded < 1_000) {
            return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter' }).format(rounded)
        }
    }

    const kilometers = meters / 1_000
    return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'kilometer',
        maximumFractionDigits: kilometers < 10 ? 1 : 0,
        minimumFractionDigits: kilometers < 10 ? 1 : 0
    }).format(kilometers)
}
