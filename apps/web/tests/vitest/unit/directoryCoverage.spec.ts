/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { Specialty } from '@findadoc/graphql'
import { availableSpecialtyOptions, coverageFromResponse } from '@/utils/directoryCoverage'

const options = [
    { code: Specialty.Dentistry, displayText: 'Dentistry' },
    { code: Specialty.Pediatrics, displayText: 'Pediatrics' },
    { code: Specialty.Psychiatry, displayText: 'Psychiatry' }
]

describe('coverageFromResponse', () => {
    it('turns the API answer into picker entries with live counts', () => {
        const coverage = coverageFromResponse({
            data: {
                availablePrefectures: [{ prefecture: { nameEn: 'Hiroshima', nameJa: '広島県' }, facilityCount: 24 }],
                availableCities: [{
                    city: { id: 'c1', slug: 'fukuyama', nameEn: 'Fukuyama', nameJa: '福山市', prefecture: { nameEn: 'Hiroshima' } }
                }],
                availableSpecialties: [{ specialty: Specialty.Pediatrics }]
            }
        })

        expect(coverage).to.deep.equal({
            prefectures: [{ name: 'Hiroshima', nameJa: '広島県', approximateFacilities: 24 }],
            cities: [{ id: 'c1', slug: 'fukuyama', nameEn: 'Fukuyama', nameJa: '福山市', prefectureEn: 'Hiroshima' }],
            specialties: [Specialty.Pediatrics]
        })
    })

    it('gives no coverage for an error or a partial answer, so the pickers keep their list', () => {
        expect(coverageFromResponse({ errors: [{}] })).to.equal(undefined)
        expect(coverageFromResponse({ data: { availablePrefectures: [] } })).to.equal(undefined)
    })
})

describe('availableSpecialtyOptions', () => {
    it('offers only specialties that have a professional, in display order', () => {
        const offered = availableSpecialtyOptions(options, [Specialty.Psychiatry, Specialty.Dentistry], '')

        expect(offered.map(option => option.code)).to.deep.equal([Specialty.Dentistry, Specialty.Psychiatry])
    })

    it('keeps the selected specialty so a shared link still shows its filter', () => {
        const offered = availableSpecialtyOptions(options, [Specialty.Dentistry], Specialty.Pediatrics)

        expect(offered.map(option => option.code)).to.deep.equal([Specialty.Dentistry, Specialty.Pediatrics])
    })

    it('offers every specialty when coverage could not load', () => {
        expect(availableSpecialtyOptions(options, undefined, '')).to.deep.equal(options)
    })
})
