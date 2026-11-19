import { describe, it, expect } from 'vitest'
import { Locale, type LocalizedName } from '@findadoc/graphql'
import { formatHealthcareProfessionalName } from '~/utils/nameUtils'

const romaji: LocalizedName = { firstName: 'Hanako', middleName: 'Rose', lastName: 'Tanaka', locale: Locale.EnUs }
const japanese: LocalizedName = { firstName: '花子', lastName: '田中', locale: Locale.JaJp }

describe('formatHealthcareProfessionalName (#282)', () => {
    it('shows the Japanese name, family name first, on a Japanese page', () => {
        expect(formatHealthcareProfessionalName([romaji, japanese], Locale.JaJp)).toBe('田中 花子')
    })

    it('shows the romaji name on an English page', () => {
        expect(formatHealthcareProfessionalName([japanese, romaji], Locale.EnUs)).toBe('Hanako Tanaka')
    })

    it('shows the romaji name on a page in any other language', () => {
        expect(formatHealthcareProfessionalName([romaji, japanese], Locale.FrFr)).toBe('Hanako Tanaka')
        expect(formatHealthcareProfessionalName([romaji, japanese], Locale.ZhCn)).toBe('Hanako Tanaka')
    })

    it('does not fall back to the other name', () => {
        expect(formatHealthcareProfessionalName([romaji], Locale.JaJp)).toBe('')
        expect(formatHealthcareProfessionalName([japanese], Locale.EnUs)).toBe('')
        expect(formatHealthcareProfessionalName(undefined, Locale.EnUs)).toBe('')
    })
})
