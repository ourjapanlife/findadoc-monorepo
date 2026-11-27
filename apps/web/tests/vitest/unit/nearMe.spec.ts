import { describe, expect, it } from 'vitest'
import type { Facility } from '@findadoc/graphql'
import { buildSearchQuery, parseSearchQuery, sameSearchQueryState, type FacilitySearchResult } from '~/utils/searchDirectory'
import { formatDistance, sortByDistance } from '~/utils/nearMe'

function result(id: string, mapLatitude: number | null, mapLongitude: number | null): FacilitySearchResult {
    return {
        id,
        nameEn: id,
        nameJa: id,
        mapLatitude,
        mapLongitude,
        healthcareProfessionalIds: [],
        healthcareProfessionals: []
    } as unknown as Facility & FacilitySearchResult
}

// The visitor stands at Tokyo Station.
const TOKYO_STATION = { latitude: 35.6812, longitude: 139.7671 }

const shinjuku = result('shinjuku', 35.6896, 139.7006)
const ginza = result('ginza', 35.6717, 139.7650)
const osaka = result('osaka', 34.7024, 135.4959)
const online = result('online', null, null)

describe('sortByDistance', () => {
    it('puts the nearest facility first and gives each one its distance', () => {
        const sorted = sortByDistance([osaka, shinjuku, ginza], TOKYO_STATION)

        expect(sorted.map(facility => facility.id)).toEqual(['ginza', 'shinjuku', 'osaka'])
        expect(sorted[0]?.distanceMeters).toBeGreaterThan(900)
        expect(sorted[0]?.distanceMeters).toBeLessThan(1_300)
    })

    it('keeps every result, with facilities that have no pin last and without a distance', () => {
        const sorted = sortByDistance([online, osaka, ginza], TOKYO_STATION)

        expect(sorted.map(facility => facility.id)).toEqual(['ginza', 'osaka', 'online'])
        expect(sorted[2]?.distanceMeters).toBeUndefined()
    })

    it('keeps directory order between facilities at the same spot', () => {
        const first = result('first', 35.6717, 139.7650)
        const second = result('second', 35.6717, 139.7650)

        expect(sortByDistance([first, second], TOKYO_STATION).map(facility => facility.id))
            .toEqual(['first', 'second'])
    })

    it('does not change the list it was given', () => {
        const list = [osaka, ginza]
        sortByDistance(list, TOKYO_STATION)

        expect(list.map(facility => facility.id)).toEqual(['osaka', 'ginza'])
        expect(ginza.distanceMeters).toBeUndefined()
    })
})

describe('formatDistance', () => {
    it('rounds short distances to 50 m and never shows less than 50 m', () => {
        expect(formatDistance(12, 'en-US')).toBe('50 m')
        expect(formatDistance(337, 'en-US')).toBe('350 m')
    })

    it('shows one decimal under 10 km and whole kilometers above', () => {
        expect(formatDistance(990, 'en-US')).toBe('1.0 km')
        expect(formatDistance(1_234, 'en-US')).toBe('1.2 km')
        expect(formatDistance(48_400, 'en-US')).toBe('48 km')
    })

    it('uses the page language for the number', () => {
        expect(formatDistance(1_234, 'de-DE')).toBe('1,2 km')
    })
})

describe('sort in the search URL', () => {
    it('round-trips sort=near and carries no position', () => {
        const state = parseSearchQuery({ sort: 'near', specialty: 'dentistry' })

        expect(state.sort).toBe('near')
        expect(buildSearchQuery(state)).toEqual({ specialty: 'dentistry', sort: 'near' })
    })

    it('drops an unknown sort', () => {
        expect(parseSearchQuery({ sort: 'rating' }).sort).toBeUndefined()
        expect(buildSearchQuery(parseSearchQuery({ sort: 'rating' }))).toEqual({})
    })

    it('treats a different sort as a different search', () => {
        expect(sameSearchQueryState({ sort: 'near' }, {})).toBe(false)
        expect(sameSearchQueryState({ sort: 'NEAR' }, { sort: 'near' })).toBe(true)
    })
})
