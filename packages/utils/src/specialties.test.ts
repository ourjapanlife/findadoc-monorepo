import { describe, expect, it } from 'vitest'
import { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import {
    categoriesOfSpecialty,
    HIDDEN_SPECIALTIES,
    SPECIALTY_CATEGORY_DISPLAY_ORDER,
    SPECIALTY_CATEGORY_LABELS,
    SPECIALTY_CATEGORY_MEMBERS,
    SPECIALTY_DISPLAY_ORDER,
    SPECIALTY_GROUP,
    SPECIALTY_JA_ALIASES,
    SPECIALTY_LABELS,
    SPECIALTY_PICKER_GROUPS,
    specialtiesInGroup,
    specialtyForJapaneseName
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

    it('gives every specialty and category an English and a Japanese label', () => {
        for (const labels of [...Object.values(SPECIALTY_LABELS), ...Object.values(SPECIALTY_CATEGORY_LABELS)]) {
            expect(labels.nameEn.trim()).not.toBe('')
            expect(labels.nameJa.trim()).not.toBe('')
        }
        expect(Object.keys(SPECIALTY_LABELS).sort()).toEqual(Object.values(Specialty).sort())
        expect(Object.keys(SPECIALTY_CATEGORY_LABELS).sort()).toEqual(Object.values(SpecialtyCategory).sort())
    })

    it('files every specialty under its own picker group', () => {
        for (const specialty of SPECIALTY_DISPLAY_ORDER) {
            if (!HIDDEN_SPECIALTIES.has(specialty)) {
                expect(categoriesOfSpecialty(specialty)).toContain(SPECIALTY_GROUP[specialty])
            }
        }
    })

    it('offers only groups that hold a specialty, and leaves hidden values out of the picker', () => {
        for (const group of SPECIALTY_PICKER_GROUPS) {
            expect(specialtiesInGroup(group).length).toBeGreaterThan(0)
        }
        expect(SPECIALTY_PICKER_GROUPS).not.toContain(SpecialtyCategory.PhysicalTherapy)
        expect(specialtiesInGroup(SpecialtyCategory.Ent)).toEqual([Specialty.Otolaryngology])
    })

    it('gives every specialty at least one Japanese department name', () => {
        for (const specialty of SPECIALTY_DISPLAY_ORDER) {
            expect(SPECIALTY_JA_ALIASES[specialty].length).toBeGreaterThan(0)
        }
    })
})

// Each change below was confirmed for #277.
describe('the #277 category corrections', () => {
    it('files cosmetic and plastic surgery, not general surgery and anesthesia, under cosmetic surgery', () => {
        expect(SPECIALTY_CATEGORY_MEMBERS[SpecialtyCategory.CosmeticAndPlasticSurgery])
            .toEqual(expect.arrayContaining([Specialty.CosmeticSurgery, Specialty.PlasticSurgery]))
        expect(SPECIALTY_CATEGORY_MEMBERS[SpecialtyCategory.CosmeticAndPlasticSurgery]).not.toContain(Specialty.Surgery)
        expect(SPECIALTY_CATEGORY_MEMBERS[SpecialtyCategory.SurgeryAndAnesthesia])
            .toEqual([Specialty.Surgery, Specialty.Anesthesiology])
    })

    it('files otolaryngology under ENT, not primary care', () => {
        expect(categoriesOfSpecialty(Specialty.Otolaryngology)).toEqual([SpecialtyCategory.Ent])
    })

    it('files orthodontics under dental', () => {
        expect(categoriesOfSpecialty(Specialty.Orthodontics)).toEqual([SpecialtyCategory.Dental])
    })

    it('files pharmacy, proctology, and traumatology under a category', () => {
        expect(categoriesOfSpecialty(Specialty.Pharmacy)).toEqual([SpecialtyCategory.PharmacyAndGenetics])
        expect(categoriesOfSpecialty(Specialty.Proctology)).toEqual([SpecialtyCategory.DigestiveHealth])
        expect(categoriesOfSpecialty(Specialty.Traumatology)).toEqual([SpecialtyCategory.SportsAndRehab])
    })

    it('files physiotherapy under both physical therapy and sports and rehab', () => {
        expect(categoriesOfSpecialty(Specialty.Physiotherapy))
            .toEqual([SpecialtyCategory.SportsAndRehab, SpecialtyCategory.PhysicalTherapy])
    })

    it('keeps the specialty each homepage tile links to', () => {
        expect(SPECIALTY_CATEGORY_MEMBERS[SpecialtyCategory.PrimaryCare][0]).toBe(Specialty.InternalMedicine)
        expect(SPECIALTY_CATEGORY_MEMBERS[SpecialtyCategory.Dental][0]).toBe(Specialty.Dentistry)
        expect(SPECIALTY_CATEGORY_MEMBERS[SpecialtyCategory.ChildrensHealth][0]).toBe(Specialty.Pediatrics)
    })
})

describe('specialtyForJapaneseName', () => {
    it('finds a specialty from the department name a clinic lists', () => {
        expect(specialtyForJapaneseName('胃腸内科')).toBe(Specialty.Gastroenterology)
        expect(specialtyForJapaneseName('小児歯科')).toBe(Specialty.PediatricDentistry)
        expect(specialtyForJapaneseName('産婦人科（生殖医療）')).toBe(Specialty.ReproductiveMedicine)
        expect(specialtyForJapaneseName('耳鼻いんこう科')).toBe(Specialty.Otolaryngology)
    })

    it('finds nothing for a name it does not know', () => {
        expect(specialtyForJapaneseName('インフルエンザ')).toBeUndefined()
        expect(specialtyForJapaneseName('')).toBeUndefined()
    })
})
