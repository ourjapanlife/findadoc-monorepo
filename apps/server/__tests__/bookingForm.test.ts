import { describe, expect, it } from 'vitest'
import { BookingFormFieldType } from '@findadoc/graphql'
import {
    SHOWCASE_BOOKING_CLINIC_SITE_ID,
    formSourceForClinicSite
} from '../src/booking/formDefinitions.js'

describe('showcase booking form', () => {
    it('asks for an insurance file and a photo on the documents step', () => {
        const form = formSourceForClinicSite(SHOWCASE_BOOKING_CLINIC_SITE_ID)
        const files = form?.fields.filter(field => field.type === BookingFormFieldType.File) ?? []

        expect(files.map(field => field.id)).toEqual(['insuranceDocument', 'selfie'])
        expect(files.every(field => field.required && field.stepKey === 'documents')).toBe(true)
        expect(files.find(field => field.id === 'insuranceDocument')?.accept).toContain('application/pdf')
        expect(files.find(field => field.id === 'selfie')?.accept).toBe('image/jpeg,image/png,image/webp')
    })
})
