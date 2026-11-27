import { describe, expect, it } from 'vitest'
import { distanceMeters } from './geo.js'

const TOKYO_STATION = { latitude: 35.6812, longitude: 139.7671 }
const SHINJUKU_STATION = { latitude: 35.6896, longitude: 139.7006 }
const SHIN_OSAKA_STATION = { latitude: 34.7334, longitude: 135.5001 }

describe('distanceMeters', () => {
    it('is zero for the same point', () => {
        expect(distanceMeters(TOKYO_STATION, TOKYO_STATION)).toBe(0)
    })

    it('measures a short distance inside a city', () => {
        // Tokyo to Shinjuku station is about 6 km in a straight line.
        expect(distanceMeters(TOKYO_STATION, SHINJUKU_STATION)).toBeGreaterThan(5_900)
        expect(distanceMeters(TOKYO_STATION, SHINJUKU_STATION)).toBeLessThan(6_200)
    })

    it('measures a long distance between cities', () => {
        // Tokyo to Shin-Osaka is about 400 km in a straight line.
        const meters = distanceMeters(TOKYO_STATION, SHIN_OSAKA_STATION)
        expect(meters).toBeGreaterThan(395_000)
        expect(meters).toBeLessThan(405_000)
    })

    it('is the same in both directions', () => {
        expect(distanceMeters(TOKYO_STATION, SHIN_OSAKA_STATION))
            .toBeCloseTo(distanceMeters(SHIN_OSAKA_STATION, TOKYO_STATION), 6)
    })
})
