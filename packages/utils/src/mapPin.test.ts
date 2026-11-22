import { describe, expect, it } from 'vitest'
import { hasUsableMapPin } from './mapPin.js'

describe('hasUsableMapPin', () => {
    it('accepts a real coordinate pair', () => {
        expect(hasUsableMapPin(34.39, 132.46)).toBe(true)
    })

    it('refuses a missing, non-finite, or zero coordinate', () => {
        expect(hasUsableMapPin(null, null)).toBe(false)
        expect(hasUsableMapPin(undefined, 132.46)).toBe(false)
        expect(hasUsableMapPin(Number.NaN, 132.46)).toBe(false)
        expect(hasUsableMapPin(0, 0)).toBe(false)
    })
})
