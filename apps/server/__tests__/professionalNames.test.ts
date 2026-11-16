import { describe, expect, it } from 'vitest'
import { Locale, NameReviewStatus, type LocalizedName } from '@findadoc/graphql'
import { ErrorCode, type Result } from '../src/result.js'
import {
    NAME_PLAN_OUTCOME,
    kanaToRomaji,
    planProfessionalNames,
    romajiToKatakana
} from '../src/names/professionalNames.js'
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

describe('kanaToRomaji', () => {
    it('writes passport-style Hepburn without long vowels', () => {
        expect(kanaToRomaji('さとう')).toBe('Sato')
        expect(kanaToRomaji('ゆうこ')).toBe('Yuko')
        expect(kanaToRomaji('おおの')).toBe('Ono')
    })

    it('spells shi, chi, tsu, fu, ji, and the small ya, yu, yo', () => {
        expect(kanaToRomaji('しんいち')).toBe('Shinichi')
        expect(kanaToRomaji('つよし')).toBe('Tsuyoshi')
        expect(kanaToRomaji('ふじ')).toBe('Fuji')
        expect(kanaToRomaji('きょうこ')).toBe('Kyoko')
        expect(kanaToRomaji('じゅん')).toBe('Jun')
    })

    it('doubles the consonant after a small tsu', () => {
        expect(kanaToRomaji('はっとり')).toBe('Hattori')
        expect(kanaToRomaji('えっちゃん')).toBe('Etchan')
    })

    it('reads katakana and splits on the middle dot', () => {
        expect(kanaToRomaji('ジョン・ポール')).toBe('Jon Poru')
    })

    it('does not guess a name written in kanji', () => {
        expect(kanaToRomaji('花子')).toBeNull()
        expect(kanaToRomaji('山田はなこ')).toBeNull()
    })
})

describe('romajiToKatakana', () => {
    it('spells a romaji name in katakana', () => {
        expect(romajiToKatakana('Hanako')).toBe('ハナコ')
        expect(romajiToKatakana('Kenji')).toBe('ケンジ')
        expect(romajiToKatakana('Hattori')).toBe('ハットリ')
    })

    it('gives a common English name a readable guess', () => {
        expect(romajiToKatakana('Smith')).toBe('スミス')
        expect(romajiToKatakana('John')).toBe('ジョン')
        expect(romajiToKatakana('Anna')).toBe('アンナ')
        expect(romajiToKatakana('Scott')).toBe('スコット')
    })

    it('joins a hyphenated name with a middle dot', () => {
        expect(romajiToKatakana('Jean-Luc')).toBe(`${romajiToKatakana('Jean')}・${romajiToKatakana('Luc')}`)
    })

    it('refuses anything that is not Latin letters', () => {
        expect(romajiToKatakana('山田')).toBeNull()
        expect(romajiToKatakana('Smith2')).toBeNull()
    })
})

describe('planProfessionalNames', () => {
    it('leaves a row that already has both names alone', () => {
        const plan = planProfessionalNames([ROMAJI, JAPANESE], null)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.UNCHANGED)
        expect(plan.names).toEqual([ROMAJI, JAPANESE])
        expect(plan.nameReview).toBeNull()
    })

    it('drops names in other locales without queueing the row', () => {
        const korean: LocalizedName = { firstName: 'Hanako', lastName: 'Yamada', locale: Locale.KoKr }
        const plan = planProfessionalNames([korean, JAPANESE, ROMAJI], null)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.CLEANED)
        expect(plan.names).toEqual([ROMAJI, JAPANESE])
        expect(plan.droppedLocales).toBe(1)
        expect(plan.nameReview).toBeNull()
    })

    it('generates romaji from a kana name and queues it', () => {
        const kana: LocalizedName = { firstName: 'はなこ', lastName: 'やまだ', locale: Locale.JaJp }
        const plan = planProfessionalNames([kana], null)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.GENERATED_ROMAJI)
        expect(plan.names).toEqual([ROMAJI, kana])
        expect(plan.nameReview).toBe(NameReviewStatus.NeedsReview)
    })

    it('queues a kanji name with no romaji and does not guess one', () => {
        const plan = planProfessionalNames([JAPANESE], null)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.MISSING_ROMAJI)
        expect(plan.names).toEqual([JAPANESE])
        expect(plan.nameReview).toBe(NameReviewStatus.NeedsReview)
    })

    it('generates katakana from a romaji name, leaving the middle name out', () => {
        const plan = planProfessionalNames([{ ...ROMAJI, middleName: 'Rose' }], null)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.GENERATED_JAPANESE)
        expect(plan.names[1]).toEqual({ firstName: 'ハナコ', lastName: 'ヤマダ', locale: Locale.JaJp })
        expect(plan.nameReview).toBe(NameReviewStatus.NeedsReview)
    })

    it('moves a Japanese middle name into the first name and queues it', () => {
        const plan = planProfessionalNames(
            [ROMAJI, { firstName: 'ジョン', middleName: 'ポール', lastName: 'スミス', locale: Locale.JaJp }],
            null
        )

        expect(plan.names[1]).toEqual({ firstName: 'ジョン・ポール', lastName: 'スミス', locale: Locale.JaJp })
        expect(plan.mergedJapaneseMiddleName).toBe(true)
        expect(plan.nameReview).toBe(NameReviewStatus.NeedsReview)
    })

    it('keeps a row with neither name as it is and queues it', () => {
        const chinese: LocalizedName = { firstName: '花子', lastName: '山田', locale: Locale.ZhCn }
        const plan = planProfessionalNames([chinese], null)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.NO_USABLE_NAME)
        expect(plan.names).toEqual([chinese])
        expect(plan.nameReview).toBe(NameReviewStatus.NeedsReview)
    })

    it('does not touch a row a moderator confirmed', () => {
        const korean: LocalizedName = { firstName: 'Hanako', lastName: 'Yamada', locale: Locale.KoKr }
        const plan = planProfessionalNames([ROMAJI, korean], NameReviewStatus.Confirmed)

        expect(plan.outcome).toBe(NAME_PLAN_OUTCOME.CONFIRMED)
        expect(plan.names).toEqual([ROMAJI, korean])
    })
})
