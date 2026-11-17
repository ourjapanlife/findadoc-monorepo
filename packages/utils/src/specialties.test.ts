import { describe, expect, it } from 'vitest'
import { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import {
    categoriesOfSpecialty,
    SPECIALTY_CATEGORY_DISPLAY_ORDER,
    SPECIALTY_CATEGORY_MEMBERS,
    SPECIALTY_DISPLAY_ORDER
} from './specialties.js'

describe('specialty vocabulary', () => {
    it('lists every Specialty exactly once', () => {
        expect([...SPECIALTY_DISPLAY_ORDER].sort()).toEqual(Object.values(Specialty).sort())
    })

    it('lists every SpecialtyCategory exactly once', () => {
        expect([...SPECIALTY_CATEGORY_DISPLAY_ORDER].sort()).toEqual(Object.values(SpecialtyCategory).sort())
    })

    it('files no specialty twice under the same category', () => {
        for (const members of Object.values(SPECIALTY_CATEGORY_MEMBERS)) {
            expect(new Set(members).size).toBe(members.length)
        }
    })

    it('agrees in both directions between a specialty and its categories', () => {
        for (const specialty of SPECIALTY_DISPLAY_ORDER) {
            for (const category of categoriesOfSpecialty(specialty)) {
                expect(SPECIALTY_CATEGORY_MEMBERS[category]).toContain(specialty)
            }
        }
        for (const category of SPECIALTY_CATEGORY_DISPLAY_ORDER) {
            for (const specialty of SPECIALTY_CATEGORY_MEMBERS[category]) {
                expect(categoriesOfSpecialty(specialty)).toContain(category)
            }
        }
    })

    it('leaves a specialty with no category with an empty list', () => {
        expect(categoriesOfSpecialty(Specialty.Pharmacy)).toEqual([])
        expect(categoriesOfSpecialty(Specialty.Psychiatry)).toEqual([SpecialtyCategory.MentalHealth])
    })
})
