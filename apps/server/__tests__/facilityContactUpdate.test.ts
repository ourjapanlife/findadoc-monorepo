import { describe, expect, it } from 'vitest'
import type { ContactInput } from '@findadoc/graphql'
import { buildFacilityUpdatePatch } from '../src/services/facilityService.js'

const STORED_CONTACT: ContactInput = {
    phone: '+81312345678',
    email: 'clinic@example.com',
    website: 'https://clinic.example.com/',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fake+Clinic',
    address: {
        postalCode: '100-0001',
        prefectureEn: 'Tokyo',
        cityEn: 'Chiyoda',
        addressLine1En: '1-1 Fake',
        addressLine2En: '',
        prefectureJa: '東京都',
        cityJa: '千代田区',
        addressLine1Ja: 'フェイク1-1',
        addressLine2Ja: ''
    }
}

function contactPatch(contact: ContactInput) {
    return buildFacilityUpdatePatch({ contact }, STORED_CONTACT).contact as ContactInput
}

describe('buildFacilityUpdatePatch contact', () => {
    it('keeps the stored website and email when an address edit omits them', () => {
        const patch = contactPatch({
            phone: STORED_CONTACT.phone,
            address: { ...STORED_CONTACT.address, addressLine1En: '2-2 Fake' } as ContactInput['address']
        })

        expect(patch.website).toBe('https://clinic.example.com/')
        expect(patch.email).toBe('clinic@example.com')
        expect(patch.address?.addressLine1En).toBe('2-2 Fake')
    })

    it('keeps the stored website on a phone-only edit', () => {
        const patch = contactPatch({ phone: '+81398765432' })

        expect(patch.phone).toBe('+81398765432')
        expect(patch.website).toBe('https://clinic.example.com/')
    })

    it('saves a new website', () => {
        const patch = contactPatch({ phone: STORED_CONTACT.phone, website: 'https://new.example.com/' })

        expect(patch.website).toBe('https://new.example.com/')
        expect(patch.email).toBe('clinic@example.com')
    })

    it('clears the website when the moderator empties it', () => {
        const patch = contactPatch({ phone: STORED_CONTACT.phone, website: '' })

        expect(patch.website).toBe('')
    })
})
