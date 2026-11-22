/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { vi } from 'vitest'
import { Specialty } from '@findadoc/graphql'
import {
    availableSpecialtyOptions,
    COVERAGE_CLIENT_TTL_MS,
    coverageFromResponse,
    fetchDirectoryCoverage
} from '@/utils/directoryCoverage'

const publicGetRequest = vi.fn()

vi.mock('~/utils/graphql', () => ({
    publicGetRequest: (...args: unknown[]) => publicGetRequest(...args)
}))

const coverageData = {
    availablePrefectures: [],
    availableCities: [],
    availableSpecialties: [{ specialty: Specialty.Dentistry }]
}

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
    it('offers only specialties that have a professional, most available first', () => {
        const offered = availableSpecialtyOptions(options, [Specialty.Psychiatry, Specialty.Dentistry], '')

        expect(offered.map(option => option.code)).to.deep.equal([Specialty.Psychiatry, Specialty.Dentistry])
    })

    it('keeps the selected specialty, last, so a shared link still shows its filter', () => {
        const offered = availableSpecialtyOptions(options, [Specialty.Dentistry], Specialty.Pediatrics)

        expect(offered.map(option => option.code)).to.deep.equal([Specialty.Dentistry, Specialty.Pediatrics])
    })

    it('offers every specialty when coverage could not load', () => {
        expect(availableSpecialtyOptions(options, undefined, '')).to.deep.equal(options)
    })
})

describe('fetchDirectoryCoverage', () => {
    beforeEach(() => {
        publicGetRequest.mockReset()
    })

    it('shares an answer within the TTL and asks again after it', async () => {
        publicGetRequest.mockResolvedValue(coverageData)
        let time = 1000
        const now = () => time

        await fetchDirectoryCoverage('ttl-check', now)
        await fetchDirectoryCoverage('ttl-check', now)
        expect(publicGetRequest.mock.calls.length).to.equal(1)

        time += COVERAGE_CLIENT_TTL_MS + 1
        await fetchDirectoryCoverage('ttl-check', now)
        expect(publicGetRequest.mock.calls.length).to.equal(2)
    })

    it('asks again at once after a failed load', async () => {
        publicGetRequest.mockRejectedValueOnce(new Error('down')).mockResolvedValue(coverageData)

        expect(await fetchDirectoryCoverage('retry-check')).to.equal(undefined)
        await Promise.resolve()
        expect(await fetchDirectoryCoverage('retry-check')).to.not.equal(undefined)
        expect(publicGetRequest.mock.calls.length).to.equal(2)
    })
})
