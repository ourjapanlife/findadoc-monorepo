export type GeoPoint = { latitude: number, longitude: number }

const EARTH_RADIUS_METERS = 6_371_000

/**
 * Straight-line distance in meters between two points, by the haversine formula. It is the
 * distance on the ground, not the route, so callers say "straight-line" when they show it.
 * The API uses it to match a Maps pin to a clinic, and search uses it to sort clinics by
 * distance from the visitor on their own device.
 */
export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
    const radians = Math.PI / 180
    const dLat = (to.latitude - from.latitude) * radians
    const dLng = (to.longitude - from.longitude) * radians
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
}
