import { describe, expect, it } from 'vitest'
import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    type ClinicBookingFormFieldInput
} from '@findadoc/graphql'
import {
    clinicFieldToFormField,
    parseClinicFormFields,
    sameClinicFields,
    type StoredClinicField
} from '../src/booking/clinicForms.js'
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
    it('uses a Find a Doc intake without identity files by default', async () => {
        const form = await formSourceById(DEFAULT_BOOKING_FORM_ID)
        expect(form?.fields.map(field => field.id)).toEqual(['email', 'phone', 'fullName', 'reason'])
        expect(form?.fields.some(field => field.type === BookingFormFieldType.File)).toBe(false)
    })

    it('asks the online consult form for an insurance file and a photo', async () => {
        const form = await formSourceById(SHOWCASE_BOOKING_FORM_ID)
        const files = form?.fields.filter(field => field.type === BookingFormFieldType.File) ?? []

        expect(files.map(field => field.id)).toEqual(['insuranceDocument', 'selfie'])
        expect(files.every(field => field.required && field.stepKey === 'documents')).toBe(true)
        expect(files.find(field => field.id === 'insuranceDocument')?.accept).toContain('application/pdf')
        expect(files.find(field => field.id === 'selfie')?.accept).toBe('image/jpeg,image/png,image/webp')
    })

    it('asks which proof of insurance the patient has, before the upload', async () => {
        const form = await formSourceById(SHOWCASE_BOOKING_FORM_ID)
        const ids = form?.fields.map(field => field.id) ?? []
        const insuranceType = form?.fields.find(field => field.id === 'insuranceType')

        expect(ids.indexOf('insuranceType')).toBe(ids.indexOf('insuranceDocument') - 1)
        expect(insuranceType?.type).toBe(BookingFormFieldType.Select)
        expect(insuranceType?.required).toBe(true)
        expect(insuranceType?.options?.map(option => option.value))
            .toEqual(['insuranceCard', 'eligibilityCertificate', 'mynaInsurance'])
        expect(form?.version).toBe(2)
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

    it('keeps a clinic form id only when that clinic wrote it', () => {
        const own = 'clinic-11111111-1111-4111-8111-111111111111'
        const other = 'clinic-22222222-2222-4222-8222-222222222222'
        expect(parseFormDefinitionIds([own, other, DEFAULT_BOOKING_FORM_ID], new Set([own])))
            .toEqual([own, DEFAULT_BOOKING_FORM_ID])
        expect(parseFormDefinitionIds([other])).toEqual([DEFAULT_BOOKING_FORM_ID])
    })
})

describe('clinic-written questions', () => {
    const english = (text: string) => [{ locale: 'en-US', text }]
    const question = (overrides: Partial<ClinicBookingFormFieldInput> = {}): ClinicBookingFormFieldInput => ({
        id: 'allergies',
        stepKey: 'visit',
        type: BookingFormFieldType.Text,
        required: true,
        labels: english('Allergies'),
        ...overrides
    })

    it('needs an English label, and keeps other locales in site order', () => {
        expect(parseClinicFormFields([question({ labels: [{ locale: 'ja-JP', text: 'アレルギー' }] })]).invalidField)
            .toBe('fields.0.labels')
        expect(parseClinicFormFields([question({ labels: [{ locale: 'xx-XX', text: 'x' }, ...english('A')] })])
            .invalidField).toBe('fields.0.labels')

        const parsed = parseClinicFormFields([question({
            labels: [{ locale: 'ja-JP', text: ' アレルギー ' }, { locale: 'ko-KR', text: '' }, ...english('Allergies')]
        })])
        const field = clinicFieldToFormField(parsed.fields![0]!)
        expect(field.labels).toEqual([{ locale: 'en-US', text: 'Allergies' }, { locale: 'ja-JP', text: 'アレルギー' }])
        expect(field.label).toBe('Allergies')
        expect(field.labelKey).toBe('')
        expect(field.maxLength).toBe(200)
    })

    it('refuses Find a Doc\'s contact ids, repeats, and unknown steps', () => {
        expect(parseClinicFormFields([question({ id: 'email' })]).invalidField).toBe('fields.0.id')
        expect(parseClinicFormFields([question(), question()]).invalidField).toBe('fields.1.id')
        expect(parseClinicFormFields([question({ id: 'Bad Id' })]).invalidField).toBe('fields.0.id')
        expect(parseClinicFormFields([question({ stepKey: 'payment' })]).invalidField).toBe('fields.0.stepKey')
        expect(parseClinicFormFields([]).invalidField).toBe('fields')
    })

    it('gives a file question identity-document retention unless the clinic picks another', () => {
        const file = parseClinicFormFields([question({ id: 'letter', stepKey: 'documents', type: BookingFormFieldType.File })])
        expect(file.fields?.[0]?.sensitivity).toBe(BookingFieldSensitivity.IdentityDocument)
        const formField = clinicFieldToFormField(file.fields![0]!)
        expect(formField.accept).toContain('application/pdf')
        expect(formField.maxBytes).toBeGreaterThan(0)

        const standard = parseClinicFormFields([question({
            id: 'letter',
            type: BookingFormFieldType.File,
            sensitivity: BookingFieldSensitivity.Standard
        })])
        expect(standard.fields?.[0]?.sensitivity).toBe(BookingFieldSensitivity.Standard)
        expect(parseClinicFormFields([question()]).fields?.[0]?.sensitivity).toBe(BookingFieldSensitivity.Standard)
    })

    it('checks choices, number bounds, and answer lengths by type', () => {
        const select = (options: ClinicBookingFormFieldInput['options']) =>
            parseClinicFormFields([question({ type: BookingFormFieldType.Select, options })])
        expect(select([{ value: 'yes', labels: english('Yes') }]).invalidField).toBe('fields.0.options')
        expect(select([{ value: 'yes', labels: english('Yes') }, { value: 'yes', labels: english('Also yes') }])
            .invalidField).toBe('fields.0.options')
        expect(select([{ value: 'yes', labels: english('Yes') }, { value: 'no', labels: english('No') }]).fields)
            .toHaveLength(1)
        expect(parseClinicFormFields([question({ options: [{ value: 'a', labels: english('A') }] })]).invalidField)
            .toBe('fields.0.options')

        const number = (min: number, max: number) =>
            parseClinicFormFields([question({ type: BookingFormFieldType.Number, min, max })])
        expect(number(0, 120).fields?.[0]).toMatchObject({ min: 0, max: 120, maxLength: null })
        expect(number(10, 1).invalidField).toBe('fields.0.min')
        expect(parseClinicFormFields([question({ min: 1 })]).invalidField).toBe('fields.0.min')

        expect(parseClinicFormFields([question({ type: BookingFormFieldType.Textarea, maxLength: 500 })])
            .fields?.[0]?.maxLength).toBe(500)
        expect(parseClinicFormFields([question({ maxLength: 5000 })]).invalidField).toBe('fields.0.maxLength')
        expect(parseClinicFormFields([question({ type: BookingFormFieldType.Email, maxLength: 10 })]).invalidField)
            .toBe('fields.0.maxLength')
    })

    it('treats the same questions in another key order as unchanged', () => {
        const first = parseClinicFormFields([question()]).fields!
        // jsonb hands the stored row back with its keys in another order.
        const reordered = first.map(field => Object.fromEntries(Object.entries(field).reverse()) as StoredClinicField)
        expect(sameClinicFields(first, reordered)).toBe(true)
        expect(sameClinicFields(first, parseClinicFormFields([question({ required: false })]).fields!)).toBe(false)
    })
})
