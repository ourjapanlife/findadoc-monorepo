import { describe, expect, test } from 'vitest'
import { Degree, Locale, Specialty } from '@findadoc/graphql'
import { ErrorCode } from '../src/result.js'
import { generateRandomUpdateSubmissionInput } from '../src/fakeData/fakeSubmissions.js'
import {
    validateApprovalProfessionalFields,
    validateUpdateSubmissionInput
} from '../src/validation/validateSubmissions.js'

const japaneseName = { locale: Locale.JaJp, firstName: 'エイダ', lastName: 'ラブレス' }

const draftProfessional = {
    names: [{ locale: Locale.EnUs, firstName: 'Ada', lastName: 'Lovelace' }],
    spokenLanguages: [Locale.EnUs],
    degrees: [],
    specialties: [],
    facilityIds: []
}

describe('submission professional fields', () => {
    test('allows an update to save empty degrees, specialties, and insurance', () => {
        const result = validateUpdateSubmissionInput({
            healthcareProfessionals: [draftProfessional]
        })

        expect(result.hasErrors).toBe(false)
    })

    test('rejects a repeated spoken language', () => {
        const result = validateUpdateSubmissionInput({
            spokenLanguages: [Locale.NlBe, Locale.NlBe]
        })

        expect(result.hasErrors).toBe(true)
        expect(result.errors?.[0].field).toBe('spokenLanguages')
        expect(result.errors?.[0].errorCode).toBe(ErrorCode.INVALID_LANGUAGE_INPUT)
    })

    test('update fixtures keep spoken languages unique', () => {
        const samples = Array.from({ length: 100 }, () =>
            generateRandomUpdateSubmissionInput().spokenLanguages ?? [])

        for (const languages of samples) {
            expect(languages).toHaveLength(2)
            expect(new Set(languages).size).toBe(languages.length)
        }
    })

    test('still rejects a degree list that is too long', () => {
        const result = validateUpdateSubmissionInput({
            healthcareProfessionals: [{
                ...draftProfessional,
                degrees: Array.from({ length: 65 }, () => Degree.Dds)
            }]
        })

        expect(result.hasErrors).toBe(true)
        expect(result.errors?.[0].field).toBe('healthcareProfessionals[0].degrees')
        expect(result.errors?.[0].errorCode).toBe(ErrorCode.INVALID_LENGTH_TOO_LONG)
    })

    test('requires degrees and specialties before approving a new professional', () => {
        const result = validateApprovalProfessionalFields({
            healthcareProfessionals: [draftProfessional]
        })

        expect(result.errors?.map(error => error.field)).toEqual([
            'healthcareProfessionals[0].degrees',
            'healthcareProfessionals[0].specialties',
            'healthcareProfessionals[0].names.ja_JP'
        ])
    })

    test('saves a draft that has only one of the two names (#282)', () => {
        const result = validateUpdateSubmissionInput({
            healthcareProfessionals: [{ ...draftProfessional, names: [japaneseName] }]
        })

        expect(result.hasErrors).toBe(false)
    })

    test('refuses a draft name in a locale other than romaji or Japanese (#282)', () => {
        const result = validateUpdateSubmissionInput({
            healthcareProfessionals: [{
                ...draftProfessional,
                names: [{ locale: Locale.ZhCn, firstName: 'Ada', lastName: 'Lovelace' }]
            }]
        })

        expect(result.errors?.map(error => [error.field, error.errorCode])).toEqual([
            ['healthcareProfessionals[0].names[0].locale', ErrorCode.NAME_LOCALE_NOT_ALLOWED]
        ])
    })

    test('requires the romaji name before approving a new professional (#282)', () => {
        const result = validateApprovalProfessionalFields({
            healthcareProfessionals: [{
                ...draftProfessional,
                names: [japaneseName],
                degrees: [Degree.Dds],
                specialties: [Specialty.Cardiology]
            }]
        })

        expect(result.errors?.map(error => [error.field, error.errorCode])).toEqual([
            ['healthcareProfessionals[0].names.en_US', ErrorCode.NAME_LOCALE_REQUIRED]
        ])
    })

    test('approves when those lists and both names are present', () => {
        const result = validateApprovalProfessionalFields({
            healthcareProfessionals: [{
                ...draftProfessional,
                names: [...draftProfessional.names, japaneseName],
                degrees: [Degree.Dds],
                specialties: [Specialty.Cardiology]
            }]
        })

        expect(result.hasErrors).toBe(false)
    })

    test('does not require the lists when the submission already links a professional', () => {
        const result = validateApprovalProfessionalFields({
            facilityHealthcareProfessionalIds: ['professional-1'],
            healthcareProfessionals: [draftProfessional]
        })

        expect(result.hasErrors).toBe(false)
    })
})
