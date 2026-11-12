import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
    Locale,
    Specialty,
    SpecialtyCategory,
    type LanguageDefinition,
    type SpecialtyCategoryDefinition,
    type SpecialtyDefinition
} from '@findadoc/graphql'
import { PUBLISHED_LOCALES } from '../src/languages/publishedLocales.js'
import { languageNames } from '../src/languages/languageNames.js'
import { gqlApiUrl } from './testSetup.test.js'

async function query<T>(source: string): Promise<T> {
    const response = await request(gqlApiUrl).post('').send({ query: source })

    expect(response.body.errors).toBeUndefined()
    return response.body.data as T
}

describe('specialties query (#24)', () => {
    it('returns every Specialty exactly once, each with an English and a Japanese label', async () => {
        const { specialties } = await query<{ specialties: SpecialtyDefinition[] }>(
            '{ specialties { code nameEn nameJa categories } }'
        )

        expect(specialties.map(specialty => specialty.code).sort()).toEqual(Object.values(Specialty).sort())
        specialties.forEach(specialty => {
            expect(specialty.nameEn.trim(), specialty.code).not.toBe('')
            expect(specialty.nameJa.trim(), specialty.code).not.toBe('')
        })
        expect(specialties.find(specialty => specialty.code === Specialty.Psychiatry)).toEqual({
            code: Specialty.Psychiatry,
            nameEn: 'Psychiatrist',
            nameJa: '精神科・心療内科',
            categories: [SpecialtyCategory.MentalHealth]
        })
        expect(specialties.find(specialty => specialty.code === Specialty.Pharmacy)?.categories).toEqual([])
    })
})

describe('specialtyCategories query (#24)', () => {
    it('returns every SpecialtyCategory, and each lists only real specialties', async () => {
        const { specialtyCategories } = await query<{ specialtyCategories: SpecialtyCategoryDefinition[] }>(
            '{ specialtyCategories { code nameEn nameJa specialties } }'
        )
        const specialtyCodes = new Set<string>(Object.values(Specialty))

        expect(specialtyCategories.map(category => category.code).sort())
            .toEqual(Object.values(SpecialtyCategory).sort())
        specialtyCategories.forEach(category => {
            expect(category.nameEn.trim(), category.code).not.toBe('')
            expect(category.nameJa.trim(), category.code).not.toBe('')
            category.specialties.forEach(code => expect(specialtyCodes.has(code), code).toBe(true))
        })
    })

    it('agrees with the categories on each specialty', async () => {
        const data = await query<{
            specialties: SpecialtyDefinition[]
            specialtyCategories: SpecialtyCategoryDefinition[]
        }>('{ specialties { code categories } specialtyCategories { code specialties } }')

        const fromCategories = data.specialtyCategories.flatMap(category =>
            category.specialties.map(specialty => `${specialty}:${category.code}`))
        const fromSpecialties = data.specialties.flatMap(specialty =>
            specialty.categories.map(category => `${specialty.code}:${category}`))

        expect(fromSpecialties.sort()).toEqual(fromCategories.sort())
    })
})

describe('languages query (#24)', () => {
    it('returns only the search facets, in published order, by default', async () => {
        const { languages } = await query<{ languages: LanguageDefinition[] }>(
            '{ languages { code nameEn nameJa nameNative published } }'
        )

        expect(languages.map(language => language.code)).toEqual([...PUBLISHED_LOCALES])
        expect(languages.every(language => language.published)).toBe(true)
        expect(languages[1]).toEqual({
            code: Locale.JaJp,
            nameEn: 'Japanese',
            nameJa: '日本語',
            nameNative: '日本語',
            published: true
        })
    })

    it('treats a null publishedOnly as the default', async () => {
        const { languages } = await query<{ languages: LanguageDefinition[] }>(
            '{ languages(publishedOnly: null) { code } }'
        )

        expect(languages.map(language => language.code)).toEqual([...PUBLISHED_LOCALES])
    })

    it('returns every Locale with publishedOnly false, the facets first and marked', async () => {
        const { languages } = await query<{ languages: LanguageDefinition[] }>(
            '{ languages(publishedOnly: false) { code nameEn nameJa nameNative published } }'
        )
        const published = new Set<string>(PUBLISHED_LOCALES)

        expect(languages.map(language => language.code).sort()).toEqual(Object.values(Locale).sort())
        expect(languages.slice(0, PUBLISHED_LOCALES.length).map(language => language.code))
            .toEqual([...PUBLISHED_LOCALES])
        languages.forEach(language => {
            expect(language.published, language.code).toBe(published.has(language.code))
            expect(language.nameEn.trim(), language.code).not.toBe('')
            expect(language.nameJa.trim(), language.code).not.toBe('')
            expect(language.nameNative.trim(), language.code).not.toBe('')
        })
    })
})

describe('language names for codes that are not facets', () => {
    it('names the language, not the region', () => {
        expect(languageNames(Locale.AkGh).nameEn).toBe('Akan')
        expect(languageNames(Locale.ZhTw).nameEn).toBe('Traditional Chinese')
    })

    it('names und as undetermined, not as ICU\'s root locale', () => {
        expect(languageNames(Locale.Und)).toEqual({ nameEn: 'Undetermined', nameJa: '未確定', nameNative: 'Undetermined' })
    })
})
