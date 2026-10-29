import { describe, expect, it } from 'vitest'
import { BookingFormFieldType } from '@findadoc/graphql'
import {
    DEFAULT_BOOKING_FORM_ID,
    SHOWCASE_BOOKING_CLINIC_SITE_ID,
    SHOWCASE_BOOKING_FORM_ID,
    chooseFormDefinitionId,
    formSourceById,
    formSourceForClinicSite
} from '../src/booking/formDefinitions.js'

describe('booking forms', () => {
    it('uses a Find a Doc intake without identity files by default', () => {
        const form = formSourceById(DEFAULT_BOOKING_FORM_ID)
        expect(form?.fields.map(field => field.id)).toEqual(['email', 'phone', 'fullName', 'reason'])
        expect(form?.fields.some(field => field.type === BookingFormFieldType.File)).toBe(false)
    })

    it('asks the showcase clinic for an insurance file and a photo', () => {
        const form = formSourceForClinicSite(SHOWCASE_BOOKING_CLINIC_SITE_ID)
        const files = form?.fields.filter(field => field.type === BookingFormFieldType.File) ?? []

        expect(form?.id).toBe(SHOWCASE_BOOKING_FORM_ID)
        expect(files.map(field => field.id)).toEqual(['insuranceDocument', 'selfie'])
        expect(files.every(field => field.required && field.stepKey === 'documents')).toBe(true)
        expect(files.find(field => field.id === 'insuranceDocument')?.accept).toContain('application/pdf')
        expect(files.find(field => field.id === 'selfie')?.accept).toBe('image/jpeg,image/png,image/webp')
    })

    it('lets ?form= pick the default intake, not an unknown id', () => {
        expect(chooseFormDefinitionId(SHOWCASE_BOOKING_FORM_ID, DEFAULT_BOOKING_FORM_ID))
            .toBe(DEFAULT_BOOKING_FORM_ID)
        expect(chooseFormDefinitionId(SHOWCASE_BOOKING_FORM_ID, 'not-a-form'))
            .toBe(SHOWCASE_BOOKING_FORM_ID)
    })
})
