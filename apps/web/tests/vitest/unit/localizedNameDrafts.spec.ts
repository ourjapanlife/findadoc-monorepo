import { describe, it, expect } from 'vitest'
import { Locale } from '@findadoc/graphql'
import { emptyNameDraft, validateLocalizedNameDrafts } from '~/utils/localizedNameDrafts'

const en = { firstName: 'Hanako', lastName: 'Tanaka', middleName: '', locale: Locale.EnUs }
const ja = { firstName: '花子', lastName: '田中', middleName: '', locale: Locale.JaJp }

describe('validateLocalizedNameDrafts', () => {
    it('returns every filled row and drops blank rows', () => {
        const result = validateLocalizedNameDrafts([en, emptyNameDraft(), ja], [], { checkCharacters: true })
        expect(result).toEqual({ names: [en, ja] })
    })

    it('needs at least one filled row', () => {
        const result = validateLocalizedNameDrafts([emptyNameDraft()], [], { checkCharacters: false })
        expect(result.error).toBe('missingLastName')
    })

    it('rejects a partly filled row', () => {
        const result = validateLocalizedNameDrafts([{ ...en, firstName: ' ' }], [], { checkCharacters: false })
        expect(result.error).toBe('missingFirstName')
    })

    it('rejects a row with no language', () => {
        const result = validateLocalizedNameDrafts([{ ...en, locale: Locale.Und }], [], { checkCharacters: false })
        expect(result.error).toBe('missingLocale')
    })

    it('rejects a language that an existing name or another row already uses', () => {
        expect(validateLocalizedNameDrafts([en], [en], { checkCharacters: false }).error)
            .toBe('nameForLocaleAlreadyExists')
        expect(validateLocalizedNameDrafts([en, { ...en, firstName: 'Ken' }], [], { checkCharacters: false }).error)
            .toBe('nameForLocaleAlreadyExists')
    })

    it('checks the characters against the language only when asked', () => {
        const latinJapanese = { ...en, locale: Locale.JaJp }
        expect(validateLocalizedNameDrafts([latinJapanese], [], { checkCharacters: true }).error)
            .toBe('charactersOfLanguageDoNotMatchNameLocale')
        expect(validateLocalizedNameDrafts([latinJapanese], [], { checkCharacters: false }).names)
            .toEqual([latinJapanese])
    })

    it('trims the saved name', () => {
        const result = validateLocalizedNameDrafts(
            [{ firstName: ' Hanako ', lastName: 'Tanaka ', middleName: ' ', locale: Locale.EnUs }],
            [],
            { checkCharacters: false }
        )
        expect(result.names).toEqual([en])
    })
})
