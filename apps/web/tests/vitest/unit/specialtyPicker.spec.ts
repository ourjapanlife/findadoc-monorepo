/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import {
    bilingualSpecialtyLabel,
    groupOfSpecialty,
    groupOptions,
    specialtiesForGroup,
    specialtyMatchesQuery
} from '@/utils/specialtyPicker'

const label = (code: string) => code

describe('specialtyPicker (#277)', () => {
    it('shows a specialty-only link under its group', () => {
        expect(groupOfSpecialty(Specialty.Gastroenterology)).to.equal(SpecialtyCategory.DigestiveHealth)
        expect(groupOfSpecialty('')).to.equal(undefined)
    })

    it('offers no specialty until a group is picked, like a city list', () => {
        const options = [{ code: Specialty.Dentistry }, { code: Specialty.Gastroenterology }]

        expect(specialtiesForGroup(options, undefined)).to.deep.equal([])
        expect(specialtiesForGroup(options, SpecialtyCategory.DigestiveHealth))
            .to.deep.equal([{ code: Specialty.Gastroenterology }])
    })

    it('with live coverage, offers only groups that hold a practiced specialty, plus the selected one', () => {
        const codes = groupOptions(label, [Specialty.Dentistry], SpecialtyCategory.MentalHealth).map(option => option.code)

        expect(codes).to.deep.equal([SpecialtyCategory.Dental, SpecialtyCategory.MentalHealth])
    })

    it('finds a specialty by the department name on a clinic site, in English, or by code', () => {
        expect(specialtyMatchesQuery(Specialty.Gastroenterology, 'Gastroenterologist', '胃腸内科')).to.equal(true)
        expect(specialtyMatchesQuery(Specialty.Gastroenterology, 'Gastroenterologist', 'gastro')).to.equal(true)
        expect(specialtyMatchesQuery(Specialty.PediatricDentistry, '小児歯科', 'pediatric_dent')).to.equal(true)
        expect(specialtyMatchesQuery(Specialty.Dentistry, 'Dentist', '胃腸内科')).to.equal(false)
    })

    it('never offers a hidden value, even when its name matches', () => {
        expect(specialtyMatchesQuery(Specialty.EntSpecialist, 'ENT Specialist', 'ENT')).to.equal(false)
        expect(specialtyMatchesQuery(Specialty.Otolaryngology, 'ENT Specialist (Otolaryngology)', 'ENT')).to.equal(true)
    })

    it('adds the Japanese department name to a label in another language, once', () => {
        expect(bilingualSpecialtyLabel(Specialty.Gastroenterology, 'Gastroenterologist')).to.equal('Gastroenterologist · 消化器内科')
        expect(bilingualSpecialtyLabel(Specialty.Gastroenterology, '消化器内科')).to.equal('消化器内科')
    })
})
