import { describe, it, expect } from 'vitest'
import { Locale, type LocalizedNameInput } from '@findadoc/graphql'
import {
    hasBothProfessionalNames,
    hasOtherLocaleNames,
    namesFromSubmittedName,
    withProfessionalNameField
} from '~/utils/professionalNames'

const romaji: LocalizedNameInput = { firstName: 'Hanako', lastName: 'Tanaka', locale: Locale.EnUs }
const japanese: LocalizedNameInput = { firstName: '花子', lastName: '田中', locale: Locale.JaJp }

describe('hasBothProfessionalNames (#282)', () => {
    it('needs a complete romaji name and a complete Japanese name', () => {
        expect(hasBothProfessionalNames([romaji, japanese])).toBe(true)
        expect(hasBothProfessionalNames([romaji])).toBe(false)
        expect(hasBothProfessionalNames([romaji, { ...japanese, firstName: ' ' }])).toBe(false)
    })
})

describe('withProfessionalNameField', () => {
    it('starts the Japanese name when its first field is typed, keeping romaji first', () => {
        expect(withProfessionalNameField([romaji], Locale.JaJp, 'lastName', '田中')).toEqual([
            romaji,
            { firstName: '', lastName: '田中', locale: Locale.JaJp }
        ])
    })

    it('drops a name once every field is cleared', () => {
        const cleared = withProfessionalNameField(
            [romaji, { firstName: '', lastName: '田中', locale: Locale.JaJp }],
            Locale.JaJp,
            'lastName',
            ''
        )

        expect(cleared).toEqual([romaji])
    })

    it('drops names in other locales on the first edit', () => {
        const korean: LocalizedNameInput = { firstName: 'Hanako', lastName: 'Tanaka', locale: Locale.KoKr }

        expect(hasOtherLocaleNames([korean, japanese])).toBe(true)
        expect(withProfessionalNameField([korean, japanese], Locale.EnUs, 'firstName', 'Hanako')).toEqual([
            { firstName: 'Hanako', lastName: '', locale: Locale.EnUs },
            japanese
        ])
    })
})

describe('namesFromSubmittedName', () => {
    it('puts a Latin name under romaji, with a middle name when there are three parts', () => {
        expect(namesFromSubmittedName(['Hanako', 'Rose', 'Tanaka'])).toEqual([
            { firstName: 'Hanako', middleName: 'Rose', lastName: 'Tanaka', locale: Locale.EnUs }
        ])
    })

    it('reads a Japanese name family name first', () => {
        expect(namesFromSubmittedName(['田中', '花子'])).toEqual([
            { lastName: '田中', firstName: '花子', locale: Locale.JaJp }
        ])
    })

    it('leaves a mixed or one-word name for the moderator', () => {
        expect(namesFromSubmittedName(['Hanako', '田中'])).toEqual([])
        expect(namesFromSubmittedName(['Hanako'])).toEqual([])
    })
})
