import { describe, expect, it } from 'vitest'
import { Locale } from '@findadoc/graphql'
import { isPublishedLocale, PUBLISHED_LOCALE_VALUES, PUBLISHED_LOCALES } from './publishedLocales.js'

describe('published locales', () => {
    it('gives every published code as a Locale value, in the same order', () => {
        expect(PUBLISHED_LOCALE_VALUES).toEqual([...PUBLISHED_LOCALES])
        expect(PUBLISHED_LOCALE_VALUES).toContain(Locale.ViVn)
        expect(PUBLISHED_LOCALE_VALUES).toContain(Locale.RuRu)
    })

    it('refuses a Locale that is not published', () => {
        expect(isPublishedLocale(Locale.Und)).toBe(false)
        expect(isPublishedLocale('vi_VN')).toBe(true)
    })
})
