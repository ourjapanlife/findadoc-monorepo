import { describe, expect, it } from 'vitest'
import { isSafeBookingObjectKey } from '../src/storage/objectStorage.js'

describe('booking object keys', () => {
    it('accepts a key under uploads/booking', () => {
        expect(isSafeBookingObjectKey('uploads/booking/clinic/upload/card.pdf')).toBe(true)
    })

    it('rejects parent segments and malformed keys', () => {
        expect(isSafeBookingObjectKey('uploads/booking/../../etc/passwd')).toBe(false)
        expect(isSafeBookingObjectKey('uploads/booking/../secret')).toBe(false)
        expect(isSafeBookingObjectKey('uploads/booking/')).toBe(false)
        expect(isSafeBookingObjectKey('other/booking/file')).toBe(false)
    })
})
