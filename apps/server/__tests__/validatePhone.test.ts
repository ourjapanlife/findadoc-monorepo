import { describe, expect, it } from 'vitest'
import type { ContactInput } from '@findadoc/graphql'
import { isAcceptedUpdatePhone, isStorablePhone, phoneForStorage } from '../src/validation/validatePhone.js'
import { validateContactInput } from '../src/validation/validateFacility.js'
import * as facilityService from '../src/services/facilityService.js'
import { contactForStorage } from '../src/services/facilityService.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { db } from '../src/kyselyClient.js'
import { asJsonb } from '../utils/dbUtils.js'
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

describe('isAcceptedUpdatePhone', () => {
    const legacyPhone = '03-5722-5500 (reception)'

    it('accepts any storable number', () => {
        expect(isAcceptedUpdatePhone('03-5722-5500', null)).toBe(true)
    })

    it('accepts an unparseable phone only when it is the stored value', () => {
        expect(isAcceptedUpdatePhone(legacyPhone, legacyPhone)).toBe(true)
        expect(isAcceptedUpdatePhone('+44 20 7946 0000', legacyPhone)).toBe(false)
        expect(isAcceptedUpdatePhone(legacyPhone, '+81357225500')).toBe(false)
        expect(isAcceptedUpdatePhone(legacyPhone, null)).toBe(false)
    })
})

describe('facility update with a legacy phone', () => {
    const legacyPhone = '03-5722-5500 (reception)'

    async function facilityWithLegacyPhone(): Promise<{ id: string, contact: ContactInput }> {
        const input = generateRandomCreateFacilityInput()
        const created = await facilityService.createFacility(input, 'test|moderator')
        expect(created.hasErrors).toBe(false)
        const contact = { ...input.contact, phone: legacyPhone }
        await db.updateTable('facilities')
            .set({ contact: asJsonb(contact) })
            .where('id', '=', created.data.id)
            .execute()
        return { id: created.data.id, contact }
    }

    async function storedPhone(id: string): Promise<unknown> {
        const row = await db.selectFrom('facilities').select('contact').where('id', '=', id).executeTakeFirstOrThrow()
        return (row.contact as { phone?: unknown }).phone
    }

    it('keeps the unchanged legacy phone so another contact field can be edited', async () => {
        const facility = await facilityWithLegacyPhone()
        const result = await facilityService.updateFacility(facility.id, {
            contact: { ...facility.contact, email: 'desk@example.com' }
        }, 'test|moderator')

        expect(result.hasErrors).toBe(false)
        expect(await storedPhone(facility.id)).toBe(legacyPhone)
    })

    it('refuses a new phone that does not parse', async () => {
        const facility = await facilityWithLegacyPhone()
        const result = await facilityService.updateFacility(facility.id, {
            contact: { ...facility.contact, phone: '+44 20 7946 0000' }
        }, 'test|moderator')

        expect(result.errors).toContainEqual({ field: 'phone', errorCode: ErrorCode.INVALID_PHONE_NUMBER, httpStatus: 400 })
        expect(await storedPhone(facility.id)).toBe(legacyPhone)
    })

    it('refuses a stale form that resends the legacy phone after it was fixed', async () => {
        const facility = await facilityWithLegacyPhone()
        const fixed = await facilityService.updateFacility(facility.id, {
            contact: { ...facility.contact, phone: '03-5722-5500' }
        }, 'test|moderator')
        expect(fixed.hasErrors).toBe(false)

        const stale = await facilityService.updateFacility(facility.id, {
            contact: { ...facility.contact, email: 'desk@example.com' }
        }, 'test|moderator')

        expect(stale.errors).toContainEqual({ field: 'phone', errorCode: ErrorCode.INVALID_PHONE_NUMBER, httpStatus: 400 })
        expect(await storedPhone(facility.id)).toBe('+81357225500')
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
