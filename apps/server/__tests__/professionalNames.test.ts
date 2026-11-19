import { describe, expect, it } from 'vitest'
import { Locale, type LocalizedName } from '@findadoc/graphql'
import { ErrorCode, type Result } from '../src/result.js'
import { validateNames } from '../src/validation/validationHealthcareProfessional.js'

const ROMAJI: LocalizedName = { firstName: 'Hanako', lastName: 'Yamada', locale: Locale.EnUs }
const JAPANESE: LocalizedName = { firstName: '花子', lastName: '山田', locale: Locale.JaJp }

function validate(names: LocalizedName[], requireBoth = true): Result<unknown> {
    const result: Result<unknown> = { data: undefined, hasErrors: false, errors: [] }
    validateNames(names, result, { requireBoth })
    return result
}

function codes(result: Result<unknown>): [string, ErrorCode][] {
    return (result.errors ?? []).map(error => [error.field, error.errorCode])
}

describe('professional name validation (#282)', () => {
    it('accepts one romaji name and one Japanese name', () => {
        expect(validate([ROMAJI, JAPANESE]).hasErrors).toBe(false)
    })

    it('requires the Japanese name', () => {
        expect(codes(validate([ROMAJI]))).toEqual([['names.ja_JP', ErrorCode.NAME_LOCALE_REQUIRED]])
    })

    it('requires the romaji name', () => {
        expect(codes(validate([JAPANESE]))).toEqual([['names.en_US', ErrorCode.NAME_LOCALE_REQUIRED]])
    })

    it('allows one name while a submission is still a draft', () => {
        expect(validate([JAPANESE], false).hasErrors).toBe(false)
    })

    it('refuses a third name', () => {
        const korean: LocalizedName = { firstName: 'Hanako', lastName: 'Yamada', locale: Locale.KoKr }

        expect(codes(validate([ROMAJI, JAPANESE, korean]))).toEqual([['names', ErrorCode.INVALID_LENGTH_TOO_LONG]])
    })

    it('refuses a locale other than romaji or Japanese', () => {
        const chinese: LocalizedName = { firstName: 'Hanako', lastName: 'Yamada', locale: Locale.ZhCn }

        expect(codes(validate([ROMAJI, chinese]))).toEqual([
            ['names[1].locale', ErrorCode.NAME_LOCALE_NOT_ALLOWED],
            ['names.ja_JP', ErrorCode.NAME_LOCALE_REQUIRED]
        ])
    })

    it('refuses Latin letters in the Japanese name', () => {
        expect(codes(validate([ROMAJI, { ...JAPANESE, firstName: 'Hanako' }]))).toEqual([
            ['names[1].firstName', ErrorCode.CONTAINS_LATIN_CHARACTER]
        ])
    })

    it('refuses a middle name on the Japanese name and keeps it on the romaji name', () => {
        const result = validate([{ ...ROMAJI, middleName: 'Rose' }, { ...JAPANESE, middleName: 'ローズ' }])

        expect(codes(result)).toEqual([['names[1].middleName', ErrorCode.MIDDLE_NAME_NOT_ALLOWED]])
    })
})
