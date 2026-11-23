import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { beforeAll, describe, expect, test } from 'vitest'
import * as gqlType from '@findadoc/graphql'
import type { gqlMutation, gqlRequest } from '../utils/gqlTool.js'
import { db } from '../src/kyselyClient.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { generateRandomCreateHealthcareProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { gqlApiUrl } from './testSetup.test.js'
import { createFacilityMutation } from './facilities.test.js'
import { createHealthcareProfessionalMutation } from './healthcareProfessional.test.js'

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const result = await request(gqlApiUrl).post('').send({ query, variables } as gqlRequest)

    expect(result.body.errors).toBeUndefined()
    return result.body.data as T
}

/** Reads a list one row per page, the way a moderator pages through it. */
async function pageThrough(field: string, type: string, filters: Record<string, unknown>, total: number) {
    const ids: string[] = []
    for (let offset = 0; offset < total; offset += 1) {
        const data = await graphql<Record<string, { id: string }[]>>(
            `query test_listTieOrder($filters: ${type}!) { ${field}(filters: $filters) { id } }`,
            { filters: { ...filters, limit: 1, offset } }
        )
        ids.push(...(data[field] ?? []).map(row => row.id))
    }
    return ids
}

// Moderation pages through the default order. Rows that tie on it need a fixed order, or a page
// can repeat one row and skip another.
describe('list order with ties', () => {
    const sharedName = `TieOrder${randomUUID()}`
    const facilityIds: string[] = []
    const professionalIds: string[] = []

    beforeAll(async () => {
        const facilityId = await (async () => {
            for (let index = 0; index < 3; index += 1) {
                const input = { ...generateRandomCreateFacilityInput(), nameEn: sharedName }
                const result = await request(gqlApiUrl).post('').send({
                    query: createFacilityMutation,
                    variables: { input }
                } as gqlMutation<gqlType.CreateFacilityInput>)

                expect(result.body.errors).toBeUndefined()
                facilityIds.push(result.body.data.createFacility.id as string)
            }
            return facilityIds[0] ?? ''
        })()

        // Six rows: tied rows that happen to come back in id order are then a 1 in 720 chance.
        for (let index = 0; index < 6; index += 1) {
            const result = await request(gqlApiUrl).post('').send({
                query: createHealthcareProfessionalMutation,
                variables: {
                    input: { ...generateRandomCreateHealthcareProfessionalInput(), facilityIds: [facilityId] }
                }
            } as gqlMutation<gqlType.CreateHealthcareProfessionalInput>)

            expect(result.body.errors).toBeUndefined()
            professionalIds.push(result.body.data.createHealthcareProfessional.id as string)
        }
        // Rows created together can share a timestamp, as the #21 import's did.
        await db.updateTable('hps')
            .set({ created_date: '2026-11-16T10:00:00.000Z' })
            .where('id', 'in', professionalIds)
            .execute()
    })

    test('facilities that share a name come back in id order, on every page', async () => {
        const ids = await pageThrough('facilities', 'FacilitySearchFilters', { nameEn: sharedName }, 3)

        expect(ids).toEqual([...facilityIds].sort())
    })

    test('professionals created at the same moment come back in id order, on every page', async () => {
        const ids = await pageThrough(
            'healthcareProfessionals',
            'HealthcareProfessionalSearchFilters',
            { ids: professionalIds },
            6
        )

        expect(ids).toEqual([...professionalIds].sort())
    })
})
