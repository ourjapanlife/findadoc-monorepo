import { describe, expect, it } from 'vitest'
import { formatJapanPhone, isValidJapanPhone, PHONE_DISPLAY, toJapanE164 } from './phone.js'

describe('toJapanE164', () => {
    it('stores any spelling of a Japanese number as E.164', () => {
        expect(toJapanE164('03-1234-5678')).toBe('+81312345678')
        expect(toJapanE164('0312345678')).toBe('+81312345678')
        expect(toJapanE164('(03) 1234 5678')).toBe('+81312345678')
        expect(toJapanE164('03.1234.5678')).toBe('+81312345678')
        expect(toJapanE164('+81 3 1234 5678')).toBe('+81312345678')
        expect(toJapanE164('  +81-3-1234-5678 ')).toBe('+81312345678')
    })

    it('reads full-width digits and Japanese dashes', () => {
        expect(toJapanE164('０３－１２３４－５６７８')).toBe('+81312345678')
        expect(toJapanE164('03ー1234ー5678')).toBe('+81312345678')
        expect(toJapanE164('03−1234−5678')).toBe('+81312345678')
    })

    it('drops a trunk 0 kept after +81', () => {
        expect(toJapanE164('+81 045-641-6961')).toBe('+81456416961')
    })

    it('handles mobile, free-dial, navi-dial, and IP numbers', () => {
        expect(toJapanE164('090-1234-5678')).toBe('+819012345678')
        expect(toJapanE164('0120-123-456')).toBe('+81120123456')
        expect(toJapanE164('0570-000-123')).toBe('+81570000123')
        expect(toJapanE164('050-1234-5678')).toBe('+815012345678')
    })

    it('refuses numbers that are not valid in Japan', () => {
        expect(toJapanE164('+1 212 555 0100')).toBeNull()
        expect(toJapanE164('03-1234-567')).toBeNull()
        expect(toJapanE164('123')).toBeNull()
        expect(toJapanE164('')).toBeNull()
        expect(toJapanE164(null)).toBeNull()
        expect(toJapanE164(undefined)).toBeNull()
    })

    it('refuses an extension or a note instead of dropping it', () => {
        expect(toJapanE164('03-1234-5678 ext. 12')).toBeNull()
        expect(toJapanE164('03-1234-5678(代表)')).toBeNull()
        expect(toJapanE164('03-1234-5678 / 03-1234-5679')).toBeNull()
        expect(isValidJapanPhone('none')).toBe(false)
    })
})

describe('formatJapanPhone', () => {
    it('places hyphens by area-code length in national format', () => {
        expect(formatJapanPhone('+81312345678', PHONE_DISPLAY.NATIONAL)).toBe('03-1234-5678')
        expect(formatJapanPhone('+81456416961', PHONE_DISPLAY.NATIONAL)).toBe('045-641-6961')
        expect(formatJapanPhone('+81476221234', PHONE_DISPLAY.NATIONAL)).toBe('0476-22-1234')
        expect(formatJapanPhone('+81120123456', PHONE_DISPLAY.NATIONAL)).toBe('0120-123-456')
    })

    it('keeps the hyphens and drops the trunk 0 after +81 in international format', () => {
        expect(formatJapanPhone('+81312345678', PHONE_DISPLAY.INTERNATIONAL)).toBe('+81 3-1234-5678')
        expect(formatJapanPhone('045 641 6961', PHONE_DISPLAY.INTERNATIONAL)).toBe('+81 45-641-6961')
        expect(formatJapanPhone('+819012345678', PHONE_DISPLAY.INTERNATIONAL)).toBe('+81 90-1234-5678')
    })

    it('returns null for a value that is not a Japanese number', () => {
        expect(formatJapanPhone('none', PHONE_DISPLAY.NATIONAL)).toBeNull()
        expect(formatJapanPhone('', PHONE_DISPLAY.INTERNATIONAL)).toBeNull()
    })
})
