import { describe, expect, it } from 'vitest'
import { isJapaneseName, isNamePartValidForLocale, isPersonNameLocale, isRomajiName } from './personName.js'

describe('isPersonNameLocale', () => {
    it('allows English and Japanese only', () => {
        expect(isPersonNameLocale('en_US')).toBe(true)
        expect(isPersonNameLocale('ja_JP')).toBe(true)
        expect(isPersonNameLocale('zh_CN')).toBe(false)
        expect(isPersonNameLocale('fr_FR')).toBe(false)
        expect(isPersonNameLocale('und')).toBe(false)
    })
})

describe('isRomajiName', () => {
    it('accepts romaji, including macrons, hyphens, apostrophes and initials', () => {
        expect(isRomajiName('Tanaka')).toBe(true)
        expect(isRomajiName('Ōno')).toBe(true)
        expect(isRomajiName('Shin\'ichi')).toBe(true)
        expect(isRomajiName('Smith-Tanaka')).toBe(true)
        expect(isRomajiName('Mary Ann')).toBe(true)
        expect(isRomajiName('J.')).toBe(true)
        expect(isRomajiName('  Sato  ')).toBe(true)
    })

    it('refuses Japanese and other scripts', () => {
        expect(isRomajiName('田中')).toBe(false)
        expect(isRomajiName('Tanaka太郎')).toBe(false)
        expect(isRomajiName('タナカ')).toBe(false)
        expect(isRomajiName('Иванов')).toBe(false)
        expect(isRomajiName('王')).toBe(false)
    })

    it('refuses empty values, digits and stray punctuation', () => {
        expect(isRomajiName('')).toBe(false)
        expect(isRomajiName(' ')).toBe(false)
        expect(isRomajiName('Ken2')).toBe(false)
        expect(isRomajiName('-Ken')).toBe(false)
        expect(isRomajiName('Ken  Sato')).toBe(false)
    })
})

describe('isJapaneseName', () => {
    it('accepts kanji, hiragana and katakana', () => {
        expect(isJapaneseName('田中')).toBe(true)
        expect(isJapaneseName('佐々木')).toBe(true)
        expect(isJapaneseName('さくら')).toBe(true)
        expect(isJapaneseName('ジョン')).toBe(true)
        expect(isJapaneseName('メアリー・アン')).toBe(true)
        expect(isJapaneseName('ﾀﾅｶ')).toBe(true)
        expect(isJapaneseName('田中　太郎')).toBe(true)
    })

    it('refuses romaji, mixed scripts and punctuation alone', () => {
        expect(isJapaneseName('Tanaka')).toBe(false)
        expect(isJapaneseName('田中Taro')).toBe(false)
        expect(isJapaneseName('ー')).toBe(false)
        expect(isJapaneseName('田中1')).toBe(false)
        expect(isJapaneseName('김')).toBe(false)
        expect(isJapaneseName('')).toBe(false)
    })
})

describe('isNamePartValidForLocale', () => {
    it('checks the script of the name locale', () => {
        expect(isNamePartValidForLocale('Tanaka', 'en_US')).toBe(true)
        expect(isNamePartValidForLocale('田中', 'ja_JP')).toBe(true)
        expect(isNamePartValidForLocale('田中', 'en_US')).toBe(false)
        expect(isNamePartValidForLocale('Tanaka', 'ja_JP')).toBe(false)
    })

    it('refuses every other locale', () => {
        expect(isNamePartValidForLocale('Wang', 'zh_CN')).toBe(false)
    })
})
