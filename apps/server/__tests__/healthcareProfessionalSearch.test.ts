import request from 'supertest'
import { expect, describe, test, beforeAll } from 'vitest'
import { Error, ErrorCode } from '../src/result.js'
import { generateRandomCreateHealthcareProfessionalInput as generateCreateProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { gqlMutation, gqlRequest } from '../utils/gqlTool.js'
import {
    CreateFacilityInput,
    CreateHealthcareProfessionalInput,
    Facility,
    HealthcareProfessional,
    Locale,
    RelationshipAction,
    Specialty,
    UpdateFacilityInput
} from '@findadoc/graphql'
import { gqlApiUrl } from './testSetup.test.js'
import { createFacilityMutation } from './facilities.test.js'
import { createHealthcareProfessionalMutation } from './healthcareProfessional.test.js'

// Kept out of healthcareProfessional.test.ts: testSetup imports facilities.test.ts, which imports
// that file, so anything in it runs in every test file and counts against each file's request rate limit.
describe('searchHealthcareProfessionals: facilityIds filter', () => {
    let facilityA: Facility
    let facilityB: Facility
    let facilityC: Facility
    let facilityD: Facility
    let professionalAtA: HealthcareProfessional
    let professionalAtB: HealthcareProfessional
    let professionalAtBWithSpecialty: HealthcareProfessional
    let professionalAtAAndD: HealthcareProfessional

    const createFacility = async () => {
        const result = await request(gqlApiUrl).post('').send({
            query: createFacilityMutation,
            variables: { input: generateRandomCreateFacilityInput() }
        } as gqlMutation<CreateFacilityInput>)

        expect(result.body?.errors).toBeUndefined()
        return result.body.data.createFacility as Facility
    }

    const createProfessional = async (facilityId: string, specialties: Specialty[]) => {
        const input = generateCreateProfessionalInput({ facilityIds: [facilityId] })

        input.specialties = specialties

        const result = await request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>)

        expect(result.body?.errors).toBeUndefined()
        return result.body.data.createHealthcareProfessional as HealthcareProfessional
    }

    const search = async (filters: Record<string, unknown>) => {
        const result = await request(gqlApiUrl).post('').send({
            query: searchHealthcareProfessionalsWithCount,
            variables: { filters }
        } as gqlRequest)

        return result.body
    }

    beforeAll(async () => {
        facilityA = await createFacility()
        facilityB = await createFacility()
        facilityC = await createFacility()

        professionalAtA = await createProfessional(facilityA.id, [Specialty.Dermatology])
        professionalAtB = await createProfessional(facilityB.id, [Specialty.Dermatology])
        professionalAtBWithSpecialty = await createProfessional(facilityB.id, [Specialty.Pediatrics])

        // Creating a professional links exactly one facility, so link the second one from the facility side.
        facilityD = await createFacility()
        professionalAtAAndD = await createProfessional(facilityD.id, [Specialty.Dermatology])
        const linkResult = await request(gqlApiUrl).post('').send({
            query: updateFacilityMutation,
            variables: {
                id: facilityA.id,
                input: {
                    healthcareProfessionalIds: [
                        { action: RelationshipAction.Create, otherEntityId: professionalAtAAndD.id }
                    ]
                }
            }
        } as gqlMutation<UpdateFacilityInput>)

        expect(linkResult.body?.errors).toBeUndefined()
    })

    test('returns only professionals linked to the facility', async () => {
        const body = await search({ facilityIds: [facilityB.id] })

        expect(body.errors).toBeUndefined()
        const found = body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(found.map(p => p.id).sort()).toEqual([professionalAtB.id, professionalAtBWithSpecialty.id].sort())
        // facilityIds on the result still comes from the junction table, not the filter.
        found.forEach(p => expect(p.facilityIds).toEqual([facilityB.id]))
        expect(body.data.healthcareProfessionalsTotalCount).toBe(2)
    })

    test('matches professionals at any of several facilities', async () => {
        const body = await search({ facilityIds: [facilityA.id, facilityB.id] })

        expect(body.errors).toBeUndefined()
        const found = body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(found.map(p => p.id).sort()).toEqual(
            [professionalAtA.id, professionalAtB.id, professionalAtBWithSpecialty.id, professionalAtAAndD.id].sort()
        )
        expect(body.data.healthcareProfessionalsTotalCount).toBe(4)
    })

    test('returns a professional linked to several listed facilities once', async () => {
        const body = await search({ facilityIds: [facilityA.id, facilityD.id] })

        expect(body.errors).toBeUndefined()
        const found = body.data.healthcareProfessionals as HealthcareProfessional[]

        // The inner join must not repeat the row or inflate the count.
        expect(found.map(p => p.id).sort()).toEqual([professionalAtA.id, professionalAtAAndD.id].sort())
        expect(body.data.healthcareProfessionalsTotalCount).toBe(2)
        const multiFacilityProfessional = found.find(p => p.id === professionalAtAAndD.id)

        expect(multiFacilityProfessional?.facilityIds.slice().sort()).toEqual([facilityA.id, facilityD.id].sort())
    })

    test('treats an empty facilityIds list as no filter', async () => {
        const body = await search({ facilityIds: [], ids: [professionalAtA.id, professionalAtB.id] })

        expect(body.errors).toBeUndefined()
        const found = body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(found.map(p => p.id).sort()).toEqual([professionalAtA.id, professionalAtB.id].sort())
    })

    test('combines with other filters', async () => {
        const body = await search({ facilityIds: [facilityB.id], specialties: [Specialty.Pediatrics] })

        expect(body.errors).toBeUndefined()
        const found = body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(found.map(p => p.id)).toEqual([professionalAtBWithSpecialty.id])
        expect(body.data.healthcareProfessionalsTotalCount).toBe(1)
    })

    test('returns nothing for a facility with no professionals', async () => {
        const body = await search({ facilityIds: [facilityC.id] })

        expect(body.errors).toBeUndefined()
        expect(body.data.healthcareProfessionals).toEqual([])
        expect(body.data.healthcareProfessionalsTotalCount).toBe(0)
    })

    test('rejects a facility id that is not a UUID', async () => {
        const body = await search({ facilityIds: ['not-a-uuid'] })
        const errors = body.errors[0].extensions.errors as Error[]

        expect(errors[0].field).toBe('facilityIds')
        expect(errors[0].errorCode).toBe(ErrorCode.INVALID_ID)
    })
})

describe('searchHealthcareProfessionals: name query', () => {
    let exact: HealthcareProfessional
    let nearby: HealthcareProfessional

    let facility: Facility

    const createNamed = async (firstName: string, japaneseFirstName: string) => {
        const input = generateCreateProfessionalInput({ facilityIds: [facility.id] })

        input.names = [
            { firstName, lastName: 'Vexmarbury', locale: Locale.EnUs },
            { firstName: japaneseFirstName, lastName: '鷺宮', locale: Locale.JaJp }
        ]
        const result = await request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>)

        expect(result.body?.errors).toBeUndefined()
        return result.body.data.createHealthcareProfessional as HealthcareProfessional
    }

    // The test database keeps rows from earlier runs, so the search is limited to this run's facility.
    const foundIds = async (query: string) => {
        const result = await request(gqlApiUrl).post('').send({
            query: searchHealthcareProfessionalsWithCount,
            variables: { filters: { query, facilityIds: [facility.id], limit: 20 } }
        } as gqlRequest)

        expect(result.body.errors).toBeUndefined()
        return (result.body.data.healthcareProfessionals as HealthcareProfessional[]).map(p => p.id)
    }

    beforeAll(async () => {
        const facilityResult = await request(gqlApiUrl).post('').send({
            query: createFacilityMutation,
            variables: { input: generateRandomCreateFacilityInput() }
        } as gqlMutation<CreateFacilityInput>)

        expect(facilityResult.body?.errors).toBeUndefined()
        facility = facilityResult.body.data.createFacility as Facility
        exact = await createNamed('Quillon', '澪')
        // Half-width katakana, which the name check accepts.
        nearby = await createNamed('Quillan', 'ﾘﾝ')
    })

    test('matches first and last name in either order', async () => {
        // Quillan is one letter off, so it follows the exact match.
        expect(await foundIds('Quillon Vexmarbury')).toEqual([exact.id, nearby.id])
        expect(await foundIds('vexmarbury quillon')).toEqual([exact.id, nearby.id])
    })

    test('matches a Japanese name with or without a space, in either order', async () => {
        expect(await foundIds('鷺宮澪')).toEqual([exact.id])
        expect(await foundIds('澪　鷺宮')).toEqual([exact.id])
    })

    test('matches half-width and full-width katakana alike', async () => {
        expect(await foundIds('ﾘﾝ')).toEqual([nearby.id])
        expect(await foundIds('鷺宮リン')).toEqual([nearby.id])
    })

    test('forgives a typo in a romaji name and lists exact matches first', async () => {
        expect(await foundIds('Vexmarbry')).toHaveLength(2)
        expect(await foundIds('Quillan Vexmarbury')).toEqual([nearby.id, exact.id])
    })

    test('needs every word to match', async () => {
        expect(await foundIds('Quillon Zzyzxwq')).toEqual([])
    })
})

const searchHealthcareProfessionalsWithCount = `query test_searchHealthcareProfessionalsWithCount($filters: HealthcareProfessionalSearchFilters!) {
    healthcareProfessionals(filters: $filters) {
        id
        facilityIds
    }
    healthcareProfessionalsTotalCount(filters: $filters)
}`

const updateFacilityMutation = `mutation test_linkFacilityProfessional($id: ID!, $input: UpdateFacilityInput!) {
    updateFacility(id: $id, input: $input) {
        id
    }
}`
