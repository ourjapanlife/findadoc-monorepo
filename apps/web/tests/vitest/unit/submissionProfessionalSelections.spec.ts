import { describe, expect, it } from 'vitest'
import { Degree, Locale, Specialty } from '@findadoc/graphql'
import { hasRequiredHealthcareProfessionalSelections } from '~/utils/moderationFormValidationUtils'

const completeSelections = {
    degrees: [Degree.Dds],
    specialties: [Specialty.Cardiology],
    spokenLanguages: [Locale.EnUs]
}

describe('submission professional selections', () => {
    it('is complete when approval has degrees, specialties, and languages', () => {
        expect(hasRequiredHealthcareProfessionalSelections(completeSelections)).toBe(true)
    })

    it.each([
        'degrees',
        'specialties',
        'spokenLanguages'
    ] as const)('blocks approval when %s is empty', field => {
        expect(hasRequiredHealthcareProfessionalSelections({
            ...completeSelections,
            [field]: []
        })).toBe(false)
    })
})
