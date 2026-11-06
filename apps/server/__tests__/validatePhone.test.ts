import { describe, expect, it } from 'vitest'
import { isStorablePhone, phoneForStorage } from '../src/validation/validatePhone.js'
import { validateContactInput } from '../src/validation/validateFacility.js'
import { contactForStorage } from '../src/services/facilityService.js'
import { ErrorCode } from '../src/result.js'

describe('facility phone validation', () => {
    it('accepts a Japanese number with any spacing or hyphens', () => {
        expect(isStorablePhone('03-5722-5500')).toBe(true)
        expect(isStorablePhone('03 5722 5500')).toBe(true)
        expect(isStorablePhone('+81 045-641-6961')).toBe(true)
        expect(isStorablePhone('０９０１２３４５６７８')).toBe(true)
    })

    it('refuses a foreign number, a note, or an over-long value', () => {
        expect(isStorablePhone('+1 212 555 0100')).toBe(false)
        expect(isStorablePhone('03-5722-5500 (reception)')).toBe(false)
        expect(isStorablePhone(`03-5722-5500${' '.repeat(40)}`)).toBe(false)
    })

    it('reports INVALID_PHONE_NUMBER on the phone field', () => {
        const result = validateContactInput({ phone: '+44 20 7946 0000' })
        expect(result.hasErrors).toBe(true)
        expect(result.errors).toContainEqual({
            field: 'phone',
            errorCode: ErrorCode.INVALID_PHONE_NUMBER,
            httpStatus: 400
        })
        expect(validateContactInput({ phone: '045-641-6961' }).hasErrors).toBe(false)
        expect(validateContactInput({ phone: '' }).hasErrors).toBe(false)
    })
})

describe('phoneForStorage', () => {
    it('writes E.164', () => {
        expect(phoneForStorage('03-5722-5500')).toBe('+81357225500')
        expect(phoneForStorage('+81 045-641-6961')).toBe('+81456416961')
    })

    it('keeps an empty phone empty', () => {
        expect(phoneForStorage('')).toBe('')
        expect(phoneForStorage('   ')).toBe('')
        expect(phoneForStorage(null)).toBe('')
        expect(phoneForStorage(undefined)).toBe('')
    })

    it('carries a stored legacy value over unchanged rather than guessing', () => {
        expect(phoneForStorage(' 03-5722-5500 (reception) ')).toBe('03-5722-5500 (reception)')
    })

    it('is applied to every contact written by create and update', () => {
        expect(contactForStorage({ phone: '03 5722 5500' }, { clearLocation: false }).phone).toBe('+81357225500')
        expect(contactForStorage({ phone: '03-5722-5500' }, { clearLocation: true }).phone).toBe('+81357225500')
    })
})
