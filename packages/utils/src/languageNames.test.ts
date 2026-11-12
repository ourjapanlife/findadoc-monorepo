import { describe, expect, it } from 'vitest'
import { PUBLISHED_LANGUAGE_NAMES } from './languageNames.js'
import { PUBLISHED_LOCALES } from './publishedLocales.js'

describe('published language names', () => {
    it('names every published locale in English, Japanese, and its own language', () => {
        expect(Object.keys(PUBLISHED_LANGUAGE_NAMES).sort()).toEqual([...PUBLISHED_LOCALES].sort())
        for (const names of Object.values(PUBLISHED_LANGUAGE_NAMES)) {
            expect(names.nameEn.trim()).not.toBe('')
            expect(names.nameJa.trim()).not.toBe('')
            expect(names.nameNative.trim()).not.toBe('')
        }
    })

    it('tells the two published Chinese codes apart', () => {
        expect(PUBLISHED_LANGUAGE_NAMES.zh_CN.nameEn).not.toBe(PUBLISHED_LANGUAGE_NAMES.zh_HK.nameEn)
        expect(PUBLISHED_LANGUAGE_NAMES.zh_CN.nameJa).not.toBe(PUBLISHED_LANGUAGE_NAMES.zh_HK.nameJa)
    })
})
