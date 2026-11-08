import { describe, expect, it } from 'vitest'
import { BookingFieldSensitivity, BookingFormFieldType, BookingPhoneRegion } from '@findadoc/graphql'
import {
    BACKUP_CONTACT_CHANNELS,
    DEFAULT_BOOKING_FORM_ID,
    SHOWCASE_BOOKING_FORM_ID,
    chooseFormDefinitionId,
    dateAnswerIsValid,
    fieldIsShown,
    formSourceById,
    japanDateYearsFromToday,
    OLDEST_BIRTH_DATE_YEARS,
    isOfferedFormId,
    listFormSources,
    parseFormDefinitionIds,
    phoneAnswer,
    staffAnswers
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
        expect(form?.version).toBe(4)
    })

    it('asks date of birth and gender on the first step, not age', () => {
        const form = formSourceById(SHOWCASE_BOOKING_FORM_ID)
        const contact = form?.fields.filter(field => field.stepKey === 'contact') ?? []
        const byId = (id: string) => contact.find(field => field.id === id)

        expect(contact.map(field => field.id)).toEqual([
            'email', 'phone', 'fullName', 'dateOfBirth', 'gender', 'genderSelfDescribed',
            'addressInJapan', 'backupContactChannel', 'backupContactHandle'
        ])
        expect(form?.fields.some(field => field.id === 'age')).toBe(false)

        expect(byId('dateOfBirth')?.type).toBe(BookingFormFieldType.Date)
        expect(byId('dateOfBirth')?.max).toBe(0)
        expect(byId('dateOfBirth')?.hintKey).toBe('bookingPage.hints.dateOfBirth')

        expect(byId('gender')?.type).toBe(BookingFormFieldType.Select)
        expect(byId('gender')?.options?.map(option => option.value))
            .toEqual(['male', 'female', 'selfDescribe'])
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
        const birth = { min: OLDEST_BIRTH_DATE_YEARS, max: 0 }

        expect(dateAnswerIsValid('1990-04-15', birth, now)).toBe(true)
        expect(dateAnswerIsValid('2026-10-31', birth, now)).toBe(true)
        expect(dateAnswerIsValid('2026-11-01', birth, now)).toBe(false)
        // Exactly 120 today in Japan still counts; one day older does not.
        expect(dateAnswerIsValid('1906-10-31', birth, now)).toBe(true)
        expect(dateAnswerIsValid('1906-10-30', birth, now)).toBe(false)
        expect(dateAnswerIsValid('1990-02-30', birth, now)).toBe(false)
        expect(dateAnswerIsValid('1990-4-15', birth, now)).toBe(false)
        expect(dateAnswerIsValid('15/04/1990', birth, now)).toBe(false)
    })

    it('moves today by calendar years, keeping a leap-day birthday in February', () => {
        expect(japanDateYearsFromToday(-120, new Date('2026-10-30T15:30:00Z'))).toBe('1906-10-31')
        expect(japanDateYearsFromToday(-1, new Date('2028-02-29T03:00:00Z'))).toBe('2027-02-28')
        expect(japanDateYearsFromToday(0, new Date('2026-10-30T14:59:00Z'))).toBe('2026-10-30')
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

    describe('a patient phone on the default intake', () => {
        // A patient can be anywhere, so their phone is not held to the Japan-only clinic rule.
        const fields = formSourceById(DEFAULT_BOOKING_FORM_ID)?.fields ?? []
        const submitWithPhone = (phone: string) => collectAnswers({ fields }, [
            { fieldId: 'email', value: 'patient@example.com' },
            { fieldId: 'phone', value: phone },
            { fieldId: 'fullName', value: 'Test Patient' },
            { fieldId: 'reason', value: 'Checkup' }
        ])

        it('accepts a number from any country', () => {
            for (const phone of ['090-1234-5678', '+1 212 555 0100', '+44 20 7946 0000', '+82 10-1234-5678']) {
                const result = submitWithPhone(phone)
                expect(result.hasErrors).toBe(false)
                expect(result.data?.storedAnswers.phone).toBe(phone)
            }
        })

        it('refuses a value too short to be a phone number', () => {
            expect(submitWithPhone('090-123').hasErrors).toBe(true)
        })
    })

    describe('a submitted online consult form', () => {
        const fields = formSourceById(SHOWCASE_BOOKING_FORM_ID)?.fields ?? []
        const base = [
            { fieldId: 'email', value: 'patient@example.com' },
            { fieldId: 'phone', value: '090-1234-5678' },
            { fieldId: 'fullName', value: 'Test Patient' },
            { fieldId: 'dateOfBirth', value: '1990-04-15' },
            { fieldId: 'addressInJapan', value: '1-1 Shiba, Minato-ku, Tokyo' },
            { fieldId: 'japaneseLevel', value: 'little' },
            { fieldId: 'consultationLanguage', value: 'ne' },
            { fieldId: 'reason', value: 'Checkup' },
            { fieldId: 'insuranceType', value: 'insuranceCard' },
            { fieldId: 'insuranceDocument', uploadId: 'upload-card' },
            { fieldId: 'selfie', uploadId: 'upload-selfie' },
            { fieldId: 'paymentMethod', value: 'bankTransfer' }
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
            expect(collect([{ fieldId: 'gender', value: 'female' }]).hasErrors).toBe(false)
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
            // Version 3 offered it; version 4 asks Male, Female, or Other.
            expect(collect([{ fieldId: 'gender', value: 'preferNotToSay' }]).hasErrors).toBe(true)

            const future = collectAnswers({ fields }, [
                ...base.map(answer => (answer.fieldId === 'dateOfBirth' ? { ...answer, value: '2999-01-01' } : answer)),
                { fieldId: 'gender', value: 'male' }
            ])
            expect(future.hasErrors).toBe(true)
        })

        const male = { fieldId: 'gender', value: 'male' }
        const withAnswer = (fieldId: string, value: string) => collectAnswers({ fields }, [
            ...base.filter(answer => answer.fieldId !== fieldId),
            male,
            { fieldId, value }
        ])

        it('stores a Japanese phone in the domestic hyphenated form, however it was typed', () => {
            for (const phone of ['09012345678', '090-1234-5678', '+81 90 1234 5678', '+81 090 1234 5678', '０９０−１２３４−５６７８']) {
                const result = withAnswer('phone', phone)
                expect(result.hasErrors).toBe(false)
                expect(result.data?.storedAnswers.phone).toBe('090-1234-5678')
            }
            expect(withAnswer('phone', '03 1234 5678').data?.storedAnswers.phone).toBe('03-1234-5678')
        })

        it('refuses a phone number from outside Japan', () => {
            for (const phone of ['+1 212 555 0100', '+44 20 7946 0000', '+82 10-1234-5678', '090-123']) {
                const result = withAnswer('phone', phone)
                expect(result.hasErrors).toBe(true)
                expect(result.errors?.[0]?.field).toBe('phone')
            }
        })

        it('requires the backup handle once any app is chosen, and drops it when none is', () => {
            for (const channel of BACKUP_CONTACT_CHANNELS) {
                const missing = collectAnswers({ fields }, [...base, male, { fieldId: 'backupContactChannel', value: channel }])
                expect(missing.hasErrors).toBe(true)

                const kept = collectAnswers({ fields }, [
                    ...base,
                    male,
                    { fieldId: 'backupContactChannel', value: channel },
                    { fieldId: 'backupContactHandle', value: 'patient-id' }
                ])
                expect(kept.data?.storedAnswers.backupContactHandle).toBe('patient-id')
            }

            const none = collectAnswers({ fields }, [...base, male, { fieldId: 'backupContactHandle', value: 'stale' }])
            expect(none.hasErrors).toBe(false)
            expect(none.data?.storedAnswers).not.toHaveProperty('backupContactHandle')
            expect(withAnswer('backupContactChannel', 'telegram').hasErrors).toBe(true)
        })

        it('requires the address, Japanese level, consultation language, and payment method', () => {
            for (const fieldId of ['addressInJapan', 'japaneseLevel', 'consultationLanguage', 'paymentMethod']) {
                const result = collectAnswers({ fields }, [...base.filter(answer => answer.fieldId !== fieldId), male])
                expect(result.hasErrors).toBe(true)
                expect(result.errors?.[0]?.field).toBe(fieldId)
            }
        })

        it('offers Nepali and Burmese as consultation languages, and the three payment methods', () => {
            expect(withAnswer('consultationLanguage', 'my').data?.storedAnswers.consultationLanguage).toBe('my')
            expect(withAnswer('consultationLanguage', 'xx').hasErrors).toBe(true)
            for (const method of ['creditCard', 'bankTransfer', 'payPay']) {
                expect(withAnswer('paymentMethod', method).data?.storedAnswers.paymentMethod).toBe(method)
            }
            expect(withAnswer('paymentMethod', 'cash').hasErrors).toBe(true)
        })

        it('keeps past illnesses optional', () => {
            expect(collectAnswers({ fields }, [...base, male]).data?.storedAnswers).not.toHaveProperty('pastIllnesses')
            expect(withAnswer('pastIllnesses', 'Asthma').data?.storedAnswers.pastIllnesses).toBe('Asthma')
        })
    })

    describe('the version 4 online consult fields', () => {
        const fields = formSourceById(SHOWCASE_BOOKING_FORM_ID)?.fields ?? []
        const byId = (id: string) => fields.find(field => field.id === id)
        const ids = fields.map(field => field.id)

        it('labels the reason "Current symptoms" and asks past illnesses right after it, as medical data', () => {
            expect(byId('reason')?.labelKey).toBe('bookingPage.fields.currentSymptoms')
            expect(ids.indexOf('pastIllnesses')).toBe(ids.indexOf('reason') + 1)
            expect(byId('pastIllnesses')?.sensitivity).toBe(BookingFieldSensitivity.Medical)
            expect(byId('pastIllnesses')?.required).toBe(false)
            // The default form keeps its own label.
            expect(formSourceById(DEFAULT_BOOKING_FORM_ID)?.fields.find(field => field.id === 'reason')?.labelKey)
                .toBe('bookingPage.fields.reason')
        })

        it('puts the interpreter note under the language and the payment notice under the payment method', () => {
            expect(byId('consultationLanguage')?.hintKey).toBe('bookingPage.hints.consultationLanguage')
            expect(byId('paymentMethod')?.hintKey).toBe('bookingPage.hints.paymentMethod')
            expect(byId('paymentMethod')?.stepKey).toBe('payment')
            expect(ids.at(-1)).toBe('paymentMethod')
        })

        it('takes a Japanese phone only on this form', () => {
            expect(byId('phone')?.phoneRegion).toBe(BookingPhoneRegion.Jp)
            expect(formSourceById(DEFAULT_BOOKING_FORM_ID)?.fields.find(field => field.id === 'phone')?.phoneRegion)
                .toBeNull()
        })

        it('shows a field for any value in anyOf, and for no empty answer', () => {
            const handle = byId('backupContactHandle')
            if (handle === undefined) {
                throw new Error('backupContactHandle is missing')
            }
            const channel = (value: string) => (fieldId: string) => (fieldId === 'backupContactChannel' ? value : '')
            expect(fieldIsShown(handle, channel('line'))).toBe(true)
            expect(fieldIsShown(handle, channel('messenger'))).toBe(true)
            expect(fieldIsShown(handle, channel(''))).toBe(false)
            expect(fieldIsShown(handle, channel('telegram'))).toBe(false)
        })
    })

    describe('phoneAnswer', () => {
        it('normalises a JP field and keeps any other field as typed', () => {
            expect(phoneAnswer({ phoneRegion: BookingPhoneRegion.Jp }, '+819012345678')).toBe('090-1234-5678')
            expect(phoneAnswer({ phoneRegion: BookingPhoneRegion.Jp }, '+1 212 555 0100')).toBeNull()
            expect(phoneAnswer({ phoneRegion: null }, '+1 212 555 0100')).toBe('+1 212 555 0100')
            expect(phoneAnswer({ phoneRegion: null }, '12345')).toBeNull()
        })
    })

    describe('staff answers', () => {
        it('carries the label the form used, and none for an answer the form no longer asks', () => {
            const answers = staffAnswers(SHOWCASE_BOOKING_FORM_ID, {
                reason: 'Cough',
                age: '35',
                fullName: 'Test Patient',
                paymentMethod: 'payPay'
            }, new Set())
            const labelOf = (fieldId: string) => answers.find(answer => answer.fieldId === fieldId)?.labelKey

            expect(labelOf('reason')).toBe('bookingPage.fields.currentSymptoms')
            expect(labelOf('paymentMethod')).toBe('bookingPage.fields.paymentMethod')
            expect(labelOf('age')).toBeNull()
            expect(answers.map(answer => answer.fieldId)).toEqual(['fullName', 'reason', 'paymentMethod', 'age'])
        })
    })
})
