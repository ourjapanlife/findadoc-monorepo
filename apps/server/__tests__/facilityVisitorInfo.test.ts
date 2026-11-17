import { describe, expect, it } from 'vitest'
import { OpeningDay, type OpeningHoursInput } from '@findadoc/graphql'
import { ErrorCode, type Result } from '../src/result.js'
import {
    validateAdditionalInfo,
    validateCreateFacilityInput,
    validateOpeningHours,
    validateUpdateFacilityInput
} from '../src/validation/validateFacility.js'
import { visitorInfoFields } from '../src/services/mappersEntityService.js'
import { buildFacilityUpdatePatch } from '../src/services/facilityService.js'

function emptyResult(): Result<unknown> {
    return { data: undefined, hasErrors: false, errors: [] }
}

function hoursErrors(blocks: OpeningHoursInput[] | null | undefined) {
    const result = emptyResult()
    validateOpeningHours(blocks, result)
    return result.errors?.map(error => [error.field, error.errorCode])
}

function noteErrors(input: { additionalInfoEn?: string | null, additionalInfoJa?: string | null }) {
    const result = emptyResult()
    validateAdditionalInfo(input, result)
    return result.errors?.map(error => [error.field, error.errorCode])
}

const SPLIT_MONDAY: OpeningHoursInput[] = [
    { day: OpeningDay.Monday, opens: '15:00', closes: '18:00' },
    { day: OpeningDay.Monday, opens: '09:00', closes: '12:30' }
]

describe('validateOpeningHours', () => {
    it('allows unknown hours', () => {
        expect(hoursErrors(undefined)).toEqual([])
        expect(hoursErrors(null)).toEqual([])
        expect(hoursErrors([])).toEqual([])
    })

    it('allows a split day', () => {
        expect(hoursErrors(SPLIT_MONDAY)).toEqual([])
    })

    it('refuses a block that closes before it opens', () => {
        expect(hoursErrors([{ day: OpeningDay.Friday, opens: '18:00', closes: '09:00' }]))
            .toEqual([['openingHours', ErrorCode.INVALID_OPENING_HOURS]])
    })

    it('refuses overlapping blocks and a time that is not HH:MM', () => {
        expect(hoursErrors([
            { day: OpeningDay.Friday, opens: '09:00', closes: '13:00' },
            { day: OpeningDay.Friday, opens: '12:00', closes: '17:00' }
        ])).toEqual([['openingHours', ErrorCode.INVALID_OPENING_HOURS]])
        expect(hoursErrors([{ day: OpeningDay.Friday, opens: '9am', closes: '17:00' }]))
            .toEqual([['openingHours', ErrorCode.INVALID_OPENING_HOURS]])
    })

    it('refuses more blocks than the cap', () => {
        const blocks = Array.from({ length: 33 }, () => ({ day: OpeningDay.Monday, opens: '09:00', closes: '10:00' }))
        expect(hoursErrors(blocks)).toEqual([['openingHours', ErrorCode.INVALID_LENGTH_TOO_LONG]])
    })
})

describe('validateAdditionalInfo', () => {
    it('allows both languages, neither, or leaving the note alone', () => {
        expect(noteErrors({ additionalInfoEn: 'Walk-ins welcome.', additionalInfoJa: '予約不要です。' })).toEqual([])
        expect(noteErrors({ additionalInfoEn: '', additionalInfoJa: '  ' })).toEqual([])
        expect(noteErrors({ additionalInfoEn: null, additionalInfoJa: null })).toEqual([])
        expect(noteErrors({})).toEqual([])
    })

    it('refuses a note in only one language and names the missing one', () => {
        expect(noteErrors({ additionalInfoEn: 'Walk-ins welcome.' }))
            .toEqual([['additionalInfoJa', ErrorCode.ADDITIONAL_INFO_BOTH_LANGUAGES]])
        expect(noteErrors({ additionalInfoEn: ' ', additionalInfoJa: '予約不要です。' }))
            .toEqual([['additionalInfoEn', ErrorCode.ADDITIONAL_INFO_BOTH_LANGUAGES]])
    })

    it('refuses a note longer than 1000 characters', () => {
        expect(noteErrors({ additionalInfoEn: 'a'.repeat(1001), additionalInfoJa: '予約不要です。' }))
            .toEqual([['additionalInfoEn', ErrorCode.INVALID_LENGTH_TOO_LONG]])
    })

    it('refuses a script tag', () => {
        expect(noteErrors({ additionalInfoEn: '<script>alert(1)</script>', additionalInfoJa: '予約不要です。' }))
            .toEqual([['additionalInfoEn', ErrorCode.INVALID_INPUT]])
    })
})

describe('facility inputs', () => {
    it('checks hours and the note on create and update', () => {
        const created = validateCreateFacilityInput({
            nameEn: 'Fake Clinic',
            nameJa: 'フェイククリニック',
            online: true,
            contact: { phone: '', email: '', website: '' },
            healthcareProfessionalIds: [],
            openingHours: [{ day: OpeningDay.Monday, opens: '12:00', closes: '09:00' }],
            additionalInfoEn: 'Walk-ins welcome.'
        })
        expect(created.errors?.map(error => error.errorCode)).toEqual([
            ErrorCode.INVALID_OPENING_HOURS,
            ErrorCode.ADDITIONAL_INFO_BOTH_LANGUAGES
        ])

        const updated = validateUpdateFacilityInput({ additionalInfoJa: '予約不要です。' })
        expect(updated.errors?.map(error => error.errorCode)).toEqual([ErrorCode.ADDITIONAL_INFO_BOTH_LANGUAGES])
    })
})

describe('visitorInfoFields', () => {
    it('reads empty or broken columns as unknown', () => {
        expect(visitorInfoFields({})).toEqual({ openingHours: [], additionalInfoEn: null, additionalInfoJa: null })
        expect(visitorInfoFields({ opening_hours: 'not json' }).openingHours).toEqual([])
    })

    it('returns hours in day order', () => {
        expect(visitorInfoFields({ opening_hours: JSON.stringify(SPLIT_MONDAY) }).openingHours).toEqual([
            { day: OpeningDay.Monday, opens: '09:00', closes: '12:30' },
            { day: OpeningDay.Monday, opens: '15:00', closes: '18:00' }
        ])
    })

    it('hides a note that is stored in only one language', () => {
        expect(visitorInfoFields({ additional_info_en: 'Walk-ins welcome.', additional_info_ja: null }))
            .toMatchObject({ additionalInfoEn: null, additionalInfoJa: null })
        expect(visitorInfoFields({ additional_info_en: 'Walk-ins welcome.', additional_info_ja: '予約不要です。' }))
            .toMatchObject({ additionalInfoEn: 'Walk-ins welcome.', additionalInfoJa: '予約不要です。' })
    })
})

describe('buildFacilityUpdatePatch', () => {
    it('stores hours in day order and clears them with an empty list', () => {
        const patch = buildFacilityUpdatePatch({ openingHours: SPLIT_MONDAY })
        expect(JSON.parse(String(patch.opening_hours))).toEqual([
            { day: OpeningDay.Monday, opens: '09:00', closes: '12:30' },
            { day: OpeningDay.Monday, opens: '15:00', closes: '18:00' }
        ])
        expect(buildFacilityUpdatePatch({ openingHours: [] }).opening_hours).toBe('[]')
        expect(buildFacilityUpdatePatch({ openingHours: null }).opening_hours).toBe('[]')
    })

    it('writes both notes together, trimmed, and blank clears both', () => {
        expect(buildFacilityUpdatePatch({ additionalInfoEn: ' Walk-ins welcome. ', additionalInfoJa: '予約不要です。' }))
            .toMatchObject({ additional_info_en: 'Walk-ins welcome.', additional_info_ja: '予約不要です。' })
        expect(buildFacilityUpdatePatch({ additionalInfoEn: '', additionalInfoJa: '' }))
            .toMatchObject({ additional_info_en: null, additional_info_ja: null })
    })

    it('leaves hours and the note alone when the update does not send them', () => {
        const patch = buildFacilityUpdatePatch({ nameEn: 'Fake Clinic' })
        expect(patch).not.toHaveProperty('opening_hours')
        expect(patch).not.toHaveProperty('additional_info_en')
        expect(patch).not.toHaveProperty('additional_info_ja')
    })
})
