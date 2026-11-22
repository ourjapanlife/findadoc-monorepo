import request from 'supertest'
import { beforeAll, describe, expect, test } from 'vitest'
import * as gqlType from '@findadoc/graphql'
import type { gqlMutation, gqlRequest } from '../utils/gqlTool.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { generateRandomCreateHealthcareProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { ErrorCode, type Error } from '../src/result.js'
import { specialtyCoverageFromRows } from '../src/services/directoryCoverageService.js'
import { gqlApiUrl } from './testSetup.test.js'
import { createFacilityMutation } from './facilities.test.js'
import { createHealthcareProfessionalMutation } from './healthcareProfessional.test.js'

const coverageQuery = `query test_directoryCoverage($prefecture: String) {
    availablePrefectures { prefecture { nameEn nameJa slug } facilityCount }
    availableCities(prefecture: $prefecture) { city { id slug nameEn prefecture { nameEn } } facilityCount }
    availableSpecialties(prefecture: $prefecture) { specialty professionalCount facilityCount }
}`

const countQuery = `query test_coverageCount($filters: FacilitySearchFilters!) {
    facilitiesTotalCount(filters: $filters)
}`

async function graphql(query: string, variables: Record<string, unknown>) {
    const result = await request(gqlApiUrl).post('').send({ query, variables } as gqlRequest)

    return result.body
}

async function totalCount(filters: gqlType.FacilitySearchFilters): Promise<number> {
    const body = await graphql(countQuery, { filters })

    expect(body.errors).toBeUndefined()
    return body.data.facilitiesTotalCount as number
}

// The pickers read these lists, so a place or specialty appears as soon as the directory has it.
describe('directory coverage', () => {
    let tottoriCity: gqlType.City

    beforeAll(async () => {
        const cities = await graphql('query { cities(prefecture: "Tottori") { id nameEn nameJa } }', {})

        expect(cities.errors).toBeUndefined()
        tottoriCity = cities.data.cities[0] as gqlType.City

        const input = generateRandomCreateFacilityInput()
        const address = input.contact.address

        if (address === undefined || address === null) {
            throw new Error('expected generateRandomCreateFacilityInput to include an address')
        }
        address.prefectureEn = 'Tottori'
        address.prefectureJa = '鳥取県'
        address.cityEn = tottoriCity.nameEn
        address.cityJa = tottoriCity.nameJa
        input.cityId = tottoriCity.id

        const facility = await request(gqlApiUrl).post('').send({
            query: createFacilityMutation,
            variables: { input }
        } as gqlMutation<gqlType.CreateFacilityInput>)

        expect(facility.body.errors).toBeUndefined()

        const professional = await request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: {
                input: {
                    ...generateRandomCreateHealthcareProfessionalInput(),
                    facilityIds: [facility.body.data.createFacility.id],
                    specialties: [gqlType.Specialty.Psychiatry]
                } satisfies gqlType.CreateHealthcareProfessionalInput
            }
        } as gqlMutation<gqlType.CreateHealthcareProfessionalInput>)

        expect(professional.body.errors).toBeUndefined()
    })

    test('lists a prefecture once it has a facility, with the count the prefecture filter returns', async () => {
        const body = await graphql(coverageQuery, { prefecture: 'Tottori' })

        expect(body.errors).toBeUndefined()
        const prefectures = body.data.availablePrefectures as gqlType.AvailablePrefecture[]
        const tottori = prefectures.find(entry => entry.prefecture.nameEn === 'Tottori')

        expect(tottori?.prefecture.nameJa).toBe('鳥取県')
        expect(tottori?.facilityCount).toBe(await totalCount({ prefecture: 'Tottori' }))
        expect(prefectures.every(entry => entry.facilityCount > 0)).toBe(true)

        const counts = prefectures.map(entry => entry.facilityCount)
        expect(counts).toEqual([...counts].sort((left, right) => right - left))
    })

    test('lists only cities in the prefecture that have a facility linked to them', async () => {
        const body = await graphql(coverageQuery, { prefecture: '鳥取県' })

        expect(body.errors).toBeUndefined()
        const cities = body.data.availableCities as gqlType.AvailableCity[]

        expect(cities.map(entry => entry.city.id)).toContain(tottoriCity.id)
        expect(cities.every(entry => entry.city.prefecture.nameEn === 'Tottori')).toBe(true)
        expect(cities.every(entry => entry.facilityCount > 0)).toBe(true)

        // The city with the most clinics, usually the largest, comes first.
        const counts = cities.map(entry => entry.facilityCount)
        expect(counts).toEqual([...counts].sort((left, right) => right - left))
    })

    test('counts a specialty in a prefecture as the facilities a specialty search there returns', async () => {
        const body = await graphql(coverageQuery, { prefecture: 'tottori' })

        expect(body.errors).toBeUndefined()
        const specialties = body.data.availableSpecialties as gqlType.AvailableSpecialty[]
        const psychiatry = specialties.find(entry => entry.specialty === gqlType.Specialty.Psychiatry)

        expect(psychiatry?.professionalCount).toBeGreaterThan(0)

        // The specialty a search finds the most facilities for comes first.
        const counts = specialties.map(entry => entry.facilityCount)
        expect(counts).toEqual([...counts].sort((left, right) => right - left))
        expect(psychiatry?.facilityCount).toBe(await totalCount({
            prefecture: 'Tottori',
            specialties: [gqlType.Specialty.Psychiatry]
        }))
    })

    test('rejects an unknown prefecture', async () => {
        const body = await graphql(coverageQuery, { prefecture: 'Atlantis' })
        const errors = body.errors[0].extensions.errors as Error[]

        expect(errors[0].field).toBe('prefecture')
        expect(errors[0].errorCode).toBe(ErrorCode.INVALID_INPUT)
    })
})

describe('specialtyCoverageFromRows', () => {
    test('drops a specialty whose professionals are at no facility, after a facility was deleted', () => {
        const coverage = specialtyCoverageFromRows([
            { specialty: gqlType.Specialty.NuclearMedicine, professional_count: '2', facility_count: '0' },
            { specialty: gqlType.Specialty.Dentistry, professional_count: '3', facility_count: '2' }
        ])

        expect(coverage).toEqual([{ specialty: gqlType.Specialty.Dentistry, professionalCount: 3, facilityCount: 2 }])
    })

    test('lists the most facilities first, then the most professionals, and drops unknown values', () => {
        const coverage = specialtyCoverageFromRows([
            { specialty: gqlType.Specialty.Pediatrics, professional_count: '1', facility_count: '1' },
            { specialty: 'NOT_A_SPECIALTY', professional_count: '9', facility_count: '9' },
            { specialty: gqlType.Specialty.Dentistry, professional_count: '4', facility_count: '3' },
            { specialty: gqlType.Specialty.Cardiology, professional_count: '2', facility_count: '1' }
        ])

        expect(coverage.map(entry => entry.specialty)).toEqual([
            gqlType.Specialty.Dentistry,
            gqlType.Specialty.Cardiology,
            gqlType.Specialty.Pediatrics
        ])
    })
})
