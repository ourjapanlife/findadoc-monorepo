import { describe, expect, it } from 'vitest'
import { buildFacilityUpdatePatch } from '../src/services/facilityService.js'

describe('online facility updates', () => {
    it('stores the online flag without an address change', () => {
        expect(buildFacilityUpdatePatch({ online: true }).online).toBe(true)
        expect(buildFacilityUpdatePatch({ online: false }).online).toBe(false)
        expect(buildFacilityUpdatePatch({})).not.toHaveProperty('online')
    })
})
