import { describe, expect, it } from 'vitest'
import { BookingFormFieldType } from '@findadoc/graphql'
import {
    DEFAULT_BOOKING_FORM_ID,
    SHOWCASE_BOOKING_FORM_ID,
    chooseFormDefinitionId,
    formSourceById,
    isOfferedFormId,
    listFormSources,
    parseFormDefinitionIds
} from '../src/booking/formDefinitions.js'

describe('booking forms', () => {
    it('uses a Find a Doc intake without identity files by default', () => {
        const form = formSourceById(DEFAULT_BOOKING_FORM_ID)
        expect(form?.fields.map(field => field.id)).toEqual(['email', 'phone', 'fullName', 'reason'])
        expect(form?.fields.some(field => field.type === BookingFormFieldType.File)).toBe(false)
    })

    it('asks the online consult form for an insurance file and a photo', () => {
        const form = formSourceById(SHOWCASE_BOOKING_FORM_ID)
        const files = form?.fields.filter(field => field.type === BookingFormFieldType.File) ?? []

        expect(files.map(field => field.id)).toEqual(['insuranceDocument', 'selfie'])
        expect(files.every(field => field.required && field.stepKey === 'documents')).toBe(true)
        expect(files.find(field => field.id === 'insuranceDocument')?.accept).toContain('application/pdf')
        expect(files.find(field => field.id === 'selfie')?.accept).toBe('image/jpeg,image/png,image/webp')
    })

    it('names every form type for the clinic picker', () => {
        expect(listFormSources().map(source => source.id)).toEqual([DEFAULT_BOOKING_FORM_ID, SHOWCASE_BOOKING_FORM_ID])
        expect(listFormSources().every(source => source.labelKey.startsWith('bookingForms.'))).toBe(true)
    })

    it('keeps only known form ids, in order, and falls back to the default', () => {
        const messy = [SHOWCASE_BOOKING_FORM_ID, 'nope', SHOWCASE_BOOKING_FORM_ID, DEFAULT_BOOKING_FORM_ID]
        expect(parseFormDefinitionIds(messy))
            .toEqual([SHOWCASE_BOOKING_FORM_ID, DEFAULT_BOOKING_FORM_ID])
        expect(parseFormDefinitionIds(['nope'])).toEqual([DEFAULT_BOOKING_FORM_ID])
        expect(parseFormDefinitionIds(null)).toEqual([DEFAULT_BOOKING_FORM_ID])
    })

    it('lets ?form= pick any form the clinic offers, and nothing else', () => {
        const offered = [SHOWCASE_BOOKING_FORM_ID, DEFAULT_BOOKING_FORM_ID]
        expect(chooseFormDefinitionId(offered, DEFAULT_BOOKING_FORM_ID)).toBe(DEFAULT_BOOKING_FORM_ID)
        expect(chooseFormDefinitionId(offered, 'not-a-form')).toBe(SHOWCASE_BOOKING_FORM_ID)
        expect(chooseFormDefinitionId(offered, null)).toBe(SHOWCASE_BOOKING_FORM_ID)
        expect(chooseFormDefinitionId([SHOWCASE_BOOKING_FORM_ID], DEFAULT_BOOKING_FORM_ID))
            .toBe(SHOWCASE_BOOKING_FORM_ID)
    })

    it('accepts a submit only for a form the clinic offers', () => {
        expect(isOfferedFormId([SHOWCASE_BOOKING_FORM_ID], SHOWCASE_BOOKING_FORM_ID)).toBe(true)
        expect(isOfferedFormId([SHOWCASE_BOOKING_FORM_ID], DEFAULT_BOOKING_FORM_ID)).toBe(false)
    })
})
