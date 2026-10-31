import { describe, expect, it } from 'vitest'
import { BookingFormFieldType } from '@findadoc/graphql'
import {
    DEFAULT_BOOKING_FORM_ID,
    SHOWCASE_BOOKING_FORM_ID,
    chooseFormDefinitionId,
    dateAnswerIsValid,
    fieldIsShown,
    formSourceById,
    OLDEST_BIRTH_DATE_DAYS,
    isOfferedFormId,
    listFormSources,
    parseFormDefinitionIds
} from '../src/booking/formDefinitions.js'
import { collectAnswers } from '../src/services/bookingService.js'

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

    it('asks which proof of insurance the patient has, before the upload', () => {
        const form = formSourceById(SHOWCASE_BOOKING_FORM_ID)
        const ids = form?.fields.map(field => field.id) ?? []
        const insuranceType = form?.fields.find(field => field.id === 'insuranceType')

        expect(ids.indexOf('insuranceType')).toBe(ids.indexOf('insuranceDocument') - 1)
        expect(insuranceType?.type).toBe(BookingFormFieldType.Select)
        expect(insuranceType?.required).toBe(true)
        expect(insuranceType?.options?.map(option => option.value))
            .toEqual(['insuranceCard', 'eligibilityCertificate', 'mynaInsurance'])
        expect(form?.version).toBe(3)
    })

    it('asks date of birth and gender on the first step, not age', () => {
        const form = formSourceById(SHOWCASE_BOOKING_FORM_ID)
        const contact = form?.fields.filter(field => field.stepKey === 'contact') ?? []
        const byId = (id: string) => contact.find(field => field.id === id)

        expect(contact.map(field => field.id))
            .toEqual(['email', 'phone', 'fullName', 'dateOfBirth', 'gender', 'genderSelfDescribed'])
        expect(form?.fields.some(field => field.id === 'age')).toBe(false)

        expect(byId('dateOfBirth')?.type).toBe(BookingFormFieldType.Date)
        expect(byId('dateOfBirth')?.max).toBe(0)
        expect(byId('dateOfBirth')?.hintKey).toBe('bookingPage.hints.dateOfBirth')

        expect(byId('gender')?.type).toBe(BookingFormFieldType.Select)
        expect(byId('gender')?.options?.map(option => option.value))
            .toEqual(['female', 'male', 'selfDescribe', 'preferNotToSay'])
        expect(byId('genderSelfDescribed')?.showWhen).toEqual({ fieldId: 'gender', equals: 'selfDescribe' })
    })

    it('shows the self-described gender field only when that choice is made', () => {
        const selfDescribed = formSourceById(SHOWCASE_BOOKING_FORM_ID)?.fields
            .find(field => field.id === 'genderSelfDescribed')
        if (selfDescribed === undefined) {
            throw new Error('genderSelfDescribed is missing')
        }
        const answers = (gender: string) => (fieldId: string) => (fieldId === 'gender' ? gender : '')

        expect(fieldIsShown(selfDescribed, answers('selfDescribe'))).toBe(true)
        expect(fieldIsShown(selfDescribed, answers('female'))).toBe(false)
        expect(fieldIsShown(selfDescribed, answers(''))).toBe(false)
        expect(fieldIsShown({ ...selfDescribed, showWhen: null }, answers(''))).toBe(true)
    })

    it('accepts a real date of birth that is not in the future, in Japan time', () => {
        // 00:30 on 31 October in Japan, still 30 October in UTC.
        const now = new Date('2026-10-30T15:30:00Z')
        const birth = { min: OLDEST_BIRTH_DATE_DAYS, max: 0 }

        expect(dateAnswerIsValid('1990-04-15', birth, now)).toBe(true)
        expect(dateAnswerIsValid('2026-10-31', birth, now)).toBe(true)
        expect(dateAnswerIsValid('2026-11-01', birth, now)).toBe(false)
        expect(dateAnswerIsValid('1900-01-01', birth, now)).toBe(false)
        expect(dateAnswerIsValid('1990-02-30', birth, now)).toBe(false)
        expect(dateAnswerIsValid('1990-4-15', birth, now)).toBe(false)
        expect(dateAnswerIsValid('15/04/1990', birth, now)).toBe(false)
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

    describe('a submitted online consult form', () => {
        const fields = formSourceById(SHOWCASE_BOOKING_FORM_ID)?.fields ?? []
        const base = [
            { fieldId: 'email', value: 'patient@example.com' },
            { fieldId: 'phone', value: '090-1234-5678' },
            { fieldId: 'fullName', value: 'Test Patient' },
            { fieldId: 'dateOfBirth', value: '1990-04-15' },
            { fieldId: 'reason', value: 'Checkup' },
            { fieldId: 'insuranceType', value: 'insuranceCard' },
            { fieldId: 'insuranceDocument', uploadId: 'upload-card' },
            { fieldId: 'selfie', uploadId: 'upload-selfie' }
        ]
        const collect = (extra: Array<{ fieldId: string, value: string }>) =>
            collectAnswers({ fields }, [...base, ...extra])

        it('keeps a self-described gender', () => {
            const result = collect([
                { fieldId: 'gender', value: 'selfDescribe' },
                { fieldId: 'genderSelfDescribed', value: 'Non-binary' }
            ])

            expect(result.hasErrors).toBe(false)
            expect(result.data?.storedAnswers.gender).toBe('selfDescribe')
            expect(result.data?.storedAnswers.genderSelfDescribed).toBe('Non-binary')
            expect(result.data?.storedAnswers.dateOfBirth).toBe('1990-04-15')
        })

        it('requires the description only when self-describe is chosen', () => {
            expect(collect([{ fieldId: 'gender', value: 'selfDescribe' }]).hasErrors).toBe(true)
            expect(collect([{ fieldId: 'gender', value: 'preferNotToSay' }]).hasErrors).toBe(false)
        })

        it('drops a description sent with another choice', () => {
            const result = collect([
                { fieldId: 'gender', value: 'female' },
                { fieldId: 'genderSelfDescribed', value: 'left over from an earlier choice' }
            ])

            expect(result.hasErrors).toBe(false)
            expect(result.data?.storedAnswers).not.toHaveProperty('genderSelfDescribed')
        })

        it('rejects a missing gender, an unknown choice, and a future date of birth', () => {
            expect(collect([]).hasErrors).toBe(true)
            expect(collect([{ fieldId: 'gender', value: 'other' }]).hasErrors).toBe(true)

            const future = collectAnswers({ fields }, [
                ...base.map(answer => (answer.fieldId === 'dateOfBirth' ? { ...answer, value: '2999-01-01' } : answer)),
                { fieldId: 'gender', value: 'male' }
            ])
            expect(future.hasErrors).toBe(true)
        })
    })
})
