import { describe, expect, it } from 'vitest'
import { Locale, Specialty } from '@findadoc/graphql'
import { isPublishedLocale, PUBLISHED_LOCALES } from '../src/languages/publishedLocales.js'
import { supportedLanguageFields, professionalFromRow } from '../src/services/mappersEntityService.js'
import {
    applyFacilityFilters,
    buildFacilityUpdatePatch,
    matchesThroughProfessional
} from '../src/services/facilityService.js'
import { validateSupportedLanguages } from '../src/validation/validateFacility.js'
import { ErrorCode, Result } from '../src/result.js'
import type { Selectable } from 'kysely'
import type { HpsTable } from '../src/typeDefs/kyselyTypes.js'
import { compileOnlyDb } from './fixtures/compileOnlyDb.js'
import type { FacilitySearchFilters } from '@findadoc/graphql'

function validationResult(): Result<unknown> {
    return { data: undefined, hasErrors: false, errors: [] }
}

function facilitySearchSql(filters: FacilitySearchFilters): string {
    return applyFacilityFilters(compileOnlyDb.selectFrom('facilities').selectAll('facilities'), filters).compile().sql
}

describe('published language allowlist', () => {
    it('keeps English and Japanese first and leaves unused locales off the facet list', () => {
        expect(PUBLISHED_LOCALES[0]).toBe('en_US')
        expect(PUBLISHED_LOCALES[1]).toBe('ja_JP')
        expect(PUBLISHED_LOCALES).toContain('ru_RU')
        expect(isPublishedLocale('ak_GH')).toBe(false)
        expect(isPublishedLocale(Locale.EnUs)).toBe(true)
        expect(isPublishedLocale(Locale.JaJp)).toBe(true)
    })

    it('accepts a published facility language and rejects one that is not a facet', () => {
        const englishAndJapanese = validationResult()

        validateSupportedLanguages([Locale.EnUs, Locale.JaJp], englishAndJapanese)
        expect(englishAndJapanese.hasErrors).toBe(false)

        const empty = validationResult()

        validateSupportedLanguages([], empty)
        expect(empty.hasErrors).toBe(false)

        const unpublished = validationResult()

        validateSupportedLanguages([Locale.AkGh], unpublished)
        expect(unpublished.errors?.[0].field).toBe('supportedLanguages')
        expect(unpublished.errors?.[0].errorCode).toBe(ErrorCode.INVALID_INPUT)
    })

    it('still displays an existing English and Japanese professional as those languages', () => {
        const professional = professionalFromRow({
            id: 'hp',
            names: [],
            spoken_languages: [Locale.EnUs, Locale.JaJp],
            degrees: [],
            primary_license: null,
            additional_credentials: [],
            license_review: null,
            license_recommendation: null,
            specialties: [],
            accepted_insurance: [],
            additional_info_for_patients: null,
            email: null,
            firestore_id: null,
            search_text: '',
            created_date: '2023-08-28T00:00:00.000Z',
            updated_date: '2023-08-28T00:00:00.000Z'
        } as Selectable<HpsTable>)

        expect(professional.spokenLanguages).toEqual([Locale.EnUs, Locale.JaJp])
    })

    it('reads facility languages and drops a locale that is not published', () => {
        expect(supportedLanguageFields({
            supported_languages: [Locale.JaJp, Locale.EnUs, Locale.AkGh, Locale.JaJp]
        }).supportedLanguages).toEqual([Locale.JaJp, Locale.EnUs])
    })

    it('stores facility languages without a professional relationship', () => {
        const patch = buildFacilityUpdatePatch({
            supportedLanguages: [Locale.EnUs, Locale.EnUs, Locale.JaJp]
        })

        expect(patch.supported_languages).toBe(JSON.stringify([Locale.EnUs, Locale.JaJp]))
        expect(patch).not.toHaveProperty('healthcareProfessionalIds')

        const cleared = buildFacilityUpdatePatch({ supportedLanguages: null })

        expect(cleared.supported_languages).toBe('[]')
    })

    it('joins professionals only when a specialty is part of the filter', () => {
        expect(matchesThroughProfessional({ spokenLanguages: [Locale.EnUs] })).toBe(false)
        expect(matchesThroughProfessional({
            spokenLanguages: [Locale.EnUs],
            specialties: []
        })).toBe(false)

        const languagesOnly = facilitySearchSql({ spokenLanguages: [Locale.EnUs, Locale.JaJp] })

        expect(languagesOnly).not.toContain('hps_facilities')
        expect(languagesOnly).not.toContain('spoken_languages')

        expect(matchesThroughProfessional({
            spokenLanguages: [Locale.EnUs],
            specialties: [Specialty.Pediatrics]
        })).toBe(true)

        const withSpecialty = facilitySearchSql({
            spokenLanguages: [Locale.EnUs],
            specialties: [Specialty.Pediatrics]
        })

        // One EXISTS, so the same professional has the specialty and speaks the language.
        expect(withSpecialty.match(/exists/g)).toHaveLength(1)
        expect(withSpecialty).toContain('"hps"."specialties" @>')
        expect(withSpecialty).toContain('"hps"."spoken_languages" @>')
    })
})
