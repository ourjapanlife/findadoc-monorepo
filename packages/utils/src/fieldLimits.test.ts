import { describe, expect, it } from 'vitest'
import { FIELD_LIMITS, fitsFieldLimit } from './fieldLimits.js'

describe('fitsFieldLimit', () => {
    it('accepts text at the limit and refuses one character more', () => {
        expect(fitsFieldLimit('correctionNotes', 'a'.repeat(FIELD_LIMITS.correctionNotes))).toBe(true)
        expect(fitsFieldLimit('correctionNotes', 'a'.repeat(FIELD_LIMITS.correctionNotes + 1))).toBe(false)
    })

    it('accepts empty text', () => {
        expect(fitsFieldLimit('website', '')).toBe(true)
    })
})
