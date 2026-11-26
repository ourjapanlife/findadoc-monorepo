import request from 'supertest'
import { expect, describe, test } from 'vitest'
import { Error, ErrorCode } from '../src/result.js'
import { generateRandomCreateHealthcareProfessionalInput as generateCreateProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { gqlMutation, gqlRequest } from '../utils/gqlTool.js'
import { CreateHealthcareProfessionalInput, Degree, HealthcareProfessional, Specialty } from '@findadoc/graphql'
import { gqlApiUrl, sharedFacilityIds } from './testSetup.test.js'
import { logger } from '../src/logger.js'

describe('createHealthcareProfessional', () => {
    test('creates a new HealthcareProfessional and adds it to the list of facilities', async () => {
        const createHealthcareProfessionalMutationRequest = {
            query: createHealthcareProfessionalMutation,
            variables: {
                input: generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })
            }
        } as gqlMutation<CreateHealthcareProfessionalInput>

        const createProfessionalResult = await request(gqlApiUrl).post('').send(createHealthcareProfessionalMutationRequest)

        //should not have errors
        const errors = createProfessionalResult.body?.errors

        if (errors) {
            expect(JSON.stringify(errors)).toBeUndefined()
        }

        const createdHealthcareProfessional =
            createProfessionalResult.body.data.createHealthcareProfessional as HealthcareProfessional

        const getHealthcareProfessionalByIdRequest = {
            query: getHealthcareProfessionalByIdQuery,
            variables: {
                id: createdHealthcareProfessional.id
            }
        } as gqlRequest

        const searchResult = await request(gqlApiUrl).post('').send(getHealthcareProfessionalByIdRequest)

        //should not have errors
        expect(searchResult.body?.errors).toBeUndefined()

        const searchedProfessional = searchResult.body.data.healthcareProfessional as HealthcareProfessional
        const originalInputValues = createHealthcareProfessionalMutationRequest.variables.input

        //validate the created HealthcareProfessional has the same values as the original
        expect(searchedProfessional).toBeDefined()
        expect(searchedProfessional.id).toBeDefined()
        expect(searchedProfessional.names[0].firstName).toEqual(originalInputValues.names[0].firstName)
        expect(searchedProfessional.names[0].lastName).toEqual(originalInputValues.names[0].lastName)
        expect(searchedProfessional.names[0].middleName).toEqual(originalInputValues.names[0].middleName || null)
        expect(searchedProfessional.degrees).toEqual(originalInputValues.degrees)
        expect(searchedProfessional.spokenLanguages).toEqual(originalInputValues.spokenLanguages)
        expect(searchedProfessional.createdDate).toBeDefined()
        expect(searchedProfessional.updatedDate).toBeDefined()
    })
})

describe('updateHealthcareProfessional', () => {
    test('updates JSONB array fields (names, degrees, specialties, spokenLanguages)', async () => {
        // -- Create a professional to update --
        const createRequest = {
            query: createHealthcareProfessionalMutation,
            variables: {
                input: generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })
            }
        } as gqlMutation<CreateHealthcareProfessionalInput>

        const createResult = await request(gqlApiUrl).post('').send(createRequest)

        const createErrors = createResult.body?.errors

        if (createErrors) {
            logger.error(JSON.stringify(createErrors))
            expect(JSON.stringify(createErrors)).toBeUndefined()
        }

        const createdProfessional = createResult.body.data.createHealthcareProfessional as HealthcareProfessional

        // -- Build an update payload with brand-new JSONB array values --
        // These fields previously failed because the patch was not wrapped with asJsonb().
        const updatedValues = generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })

        const updateRequest = {
            query: updateHealthcareProfessionalMutation,
            variables: {
                id: createdProfessional.id,
                input: {
                    names: updatedValues.names,
                    degrees: updatedValues.degrees,
                    specialties: updatedValues.specialties,
                    spokenLanguages: updatedValues.spokenLanguages
                }
            }
        } as gqlRequest

        const updateResult = await request(gqlApiUrl).post('').send(updateRequest)

        // -- The mutation must succeed (previously errored with INTERNAL_SERVER_ERROR) --
        const updateErrors = updateResult.body?.errors

        if (updateErrors) {
            logger.error(JSON.stringify(updateErrors))
            expect(JSON.stringify(updateErrors)).toBeUndefined()
        }

        const updatedProfessional = updateResult.body.data.updateHealthcareProfessional as HealthcareProfessional

        // -- Re-fetch and confirm the JSONB arrays were actually persisted --
        const getByIdRequest = {
            query: getHealthcareProfessionalByIdQuery,
            variables: { id: createdProfessional.id }
        } as gqlRequest

        const getResult = await request(gqlApiUrl).post('').send(getByIdRequest)

        expect(getResult.body?.errors).toBeUndefined()

        const persistedProfessional = getResult.body.data.healthcareProfessional as HealthcareProfessional

        expect(updatedProfessional.id).toBe(createdProfessional.id)
        expect(persistedProfessional.names[0].firstName).toEqual(updatedValues.names[0].firstName)
        expect(persistedProfessional.names[0].lastName).toEqual(updatedValues.names[0].lastName)
        expect(persistedProfessional.degrees).toEqual(updatedValues.degrees)
        expect(persistedProfessional.specialties).toEqual(updatedValues.specialties)
        expect(persistedProfessional.spokenLanguages).toEqual(updatedValues.spokenLanguages)
    })
})

describe('archiveHealthcareProfessional', () => {
    test('hides a professional from public reads, keeps the record, and unarchives it', async () => {
        const createRequest = {
            query: createHealthcareProfessionalMutation,
            variables: {
                input: generateCreateProfessionalInput({
                    facilityIds: sharedFacilityIds
                }) satisfies CreateHealthcareProfessionalInput
            }
        } as gqlMutation<CreateHealthcareProfessionalInput>

        const createResult = await request(gqlApiUrl).post('').send(createRequest)
        expect(createResult.body?.errors).toBeUndefined()
        const professionalId = (createResult.body.data.createHealthcareProfessional as HealthcareProfessional).id
        const getByIdRequest = { query: getHealthcareProfessionalByIdQuery, variables: { id: professionalId } }

        const blank = await request(gqlApiUrl).post('').send({
            query: archiveProfessionalMutation,
            variables: { id: professionalId, reason: '   ' }
        })
        const blankErrors = blank.body?.errors[0].extensions.errors as Error[]
        expect(blankErrors).toEqual([{ field: 'reason', errorCode: ErrorCode.REQUIRED, httpStatus: 400 }])

        const archived = await request(gqlApiUrl).post('').send({
            query: archiveProfessionalMutation,
            variables: { id: professionalId, reason: 'Retired from practice' }
        })
        expect(archived.body?.errors).toBeUndefined()
        const archivedProfessional = archived.body.data.archiveHealthcareProfessional as HealthcareProfessional
        expect(archivedProfessional.archivedAt).toBeTruthy()
        // The test user cannot edit professionals, so the moderator note stays hidden.
        expect(archivedProfessional.archivedReason).toBeNull()
        expect(archivedProfessional.facilityIds).toEqual(sharedFacilityIds)

        // A public read by id behaves like a missing professional.
        const missing = await request(gqlApiUrl).post('').send(getByIdRequest)
        const missingErrors = missing.body?.errors[0].extensions.errors as Error[]
        expect(missingErrors[0].field).toBe('getHealthcareProfessionalById')
        expect(missingErrors[0].errorCode).toBe(ErrorCode.NOT_FOUND)

        const listed = await request(gqlApiUrl).post('').send({
            query: searchHealthcareProfessionals,
            variables: { filters: { ids: [professionalId] } }
        })
        expect(listed.body.data.healthcareProfessionals).toEqual([])

        const again = await request(gqlApiUrl).post('').send({
            query: archiveProfessionalMutation,
            variables: { id: professionalId, reason: 'Retired from practice' }
        })
        const againErrors = again.body?.errors[0].extensions.errors as Error[]
        expect(againErrors[0].field).toBe('archiveHealthcareProfessional')
        expect(againErrors[0].errorCode).toBe(ErrorCode.ALREADY_ARCHIVED)

        const restored = await request(gqlApiUrl).post('').send({
            query: unarchiveProfessionalMutation,
            variables: { id: professionalId }
        })
        expect(restored.body?.errors).toBeUndefined()
        expect(restored.body.data.unarchiveHealthcareProfessional.archivedAt).toBeNull()

        const found = await request(gqlApiUrl).post('').send(getByIdRequest)
        expect(found.body?.errors).toBeUndefined()
        expect(found.body.data.healthcareProfessional.id).toBe(professionalId)
    })
})

describe('searchHealthcareProfessionals', () => {
    test('searches for healthcare professionals by ids filter', async () => {
        // Create two professionals
        const professionalInputs = [
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds }),
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })
        ]

        // Use Promise.all for parallel creation
        const createRequests = professionalInputs.map(input => request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>))
        const createResults = await Promise.all(createRequests)

        createResults.forEach(result => {
            expect(result.body?.errors).toBeUndefined()
        })
        const createdProfessionals: HealthcareProfessional[] = createResults.map(result =>
            result.body.data.createHealthcareProfessional as HealthcareProfessional)

        // Search by ids
        const searchHealthcareProfessionalsRequest = {
            query: searchHealthcareProfessionals,
            variables: {
                filters: {
                    ids: [createdProfessionals[0].id, createdProfessionals[1].id]
                }
            }
        } as gqlRequest

        // -- Search the professionals by id --
        const searchResult = await request(gqlApiUrl).post('').send(searchHealthcareProfessionalsRequest)

        //should not have errors
        const queryErrors = searchResult.body?.errors

        if (queryErrors) {
            logger.error(JSON.stringify(queryErrors))
            expect(queryErrors).toBeUndefined()
        }

        const foundProfessionals = searchResult.body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(foundProfessionals.length).toBe(2)
        expect(foundProfessionals.map(p => p.id)).toEqual(
            expect.arrayContaining([createdProfessionals[0].id, createdProfessionals[1].id])
        )
    })

    test('returns empty array when no professionals match ids', async () => {
        const searchRequest = {
            query: searchHealthcareProfessionals,
            variables: {
                filters: { ids: ['nonexistent-id-1', 'nonexistent-id-2'] }
            }
        }
        const searchResult = await request(gqlApiUrl).post('').send(searchRequest)

        expect(searchResult.body?.errors).toBeUndefined()
        const foundProfessionals = searchResult.body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(foundProfessionals.length).toBe(0)
    })

    test('returns limited results when limit is set', async () => {
        // Create three professionals
        const professionalInputs = [
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds }),
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds }),
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })
        ]
        // Use Promise.all for parallel creation
        const createRequests = professionalInputs.map(input => request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>))
        const createResults = await Promise.all(createRequests)

        createResults.forEach(result => {
            expect(result.body?.errors).toBeUndefined()
        })

        // Search with limit = 2
        const searchRequest = {
            query: searchHealthcareProfessionals,
            variables: {
                filters: { limit: 2 }
            }
        }
        const searchResult = await request(gqlApiUrl).post('').send(searchRequest)

        expect(searchResult.body?.errors).toBeUndefined()
        const foundProfessionals = searchResult.body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(foundProfessionals.length).toBeLessThanOrEqual(2)
    })

    test('returns paginated results when offset is set', async () => {
        // Create two professionals
        const professionalInputs = [
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds }),
            generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })
        ]
        // Use Promise.all for parallel creation
        const createRequests = professionalInputs.map(input => request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>))
        const createResults = await Promise.all(createRequests)

        createResults.forEach(result => {
            expect(result.body?.errors).toBeUndefined()
        })

        const searchRequest = {
            query: searchHealthcareProfessionals,
            variables: {
                filters: { offset: 1 }
            }
        }
        const searchResult = await request(gqlApiUrl).post('').send(searchRequest)

        expect(searchResult.body?.errors).toBeUndefined()
        const foundProfessionals = searchResult.body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(foundProfessionals.length).toBeGreaterThanOrEqual(1)
    })

    test('searches by specialties JSONB filter', async () => {
        // Create a professional with a known specialty
        const knownSpecialty = Specialty.Anesthesiology
        const input = generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })

        input.specialties = [knownSpecialty]

        const createResult = await request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>)

        expect(createResult.body?.errors).toBeUndefined()
        const created = createResult.body.data.createHealthcareProfessional as HealthcareProfessional

        // Search by that specialty using the JSONB filter
        const searchResult = await request(gqlApiUrl).post('').send({
            query: searchHealthcareProfessionalsWithDetails,
            variables: {
                filters: { specialties: [knownSpecialty] }
            }
        } as gqlRequest)

        expect(searchResult.body?.errors).toBeUndefined()
        const found = searchResult.body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(found.length).toBeGreaterThanOrEqual(1)
        expect(found.map(p => p.id)).toContain(created.id)
        // Verify the found professionals actually have the requested specialty
        found.forEach(p => {
            expect(p.specialties).toContain(knownSpecialty)
        })
    })

    test('searches by degrees JSONB filter', async () => {
        const knownDegree = Degree.Md
        const input = generateCreateProfessionalInput({ facilityIds: sharedFacilityIds })

        input.degrees = [knownDegree]

        const createResult = await request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: { input }
        } as gqlMutation<CreateHealthcareProfessionalInput>)

        expect(createResult.body?.errors).toBeUndefined()
        const created = createResult.body.data.createHealthcareProfessional as HealthcareProfessional

        // Search by that degree using the JSONB filter
        const searchResult = await request(gqlApiUrl).post('').send({
            query: searchHealthcareProfessionalsWithDetails,
            variables: {
                filters: { degrees: [knownDegree] }
            }
        } as gqlRequest)

        expect(searchResult.body?.errors).toBeUndefined()
        const found = searchResult.body.data.healthcareProfessionals as HealthcareProfessional[]

        expect(found.length).toBeGreaterThanOrEqual(1)
        expect(found.map(p => p.id)).toContain(created.id)
        found.forEach(p => {
            expect(p.degrees).toContain(knownDegree)
        })
    })
})

export const createHealthcareProfessionalMutation = `mutation test_createHealthcareProfessional($input: CreateHealthcareProfessionalInput!) {
    createHealthcareProfessional(input: $input) {
        id
        names {
            lastName
            firstName
            middleName
            locale
        }
        degrees
        specialties
        facilityIds
        spokenLanguages
        createdDate
        updatedDate
        additionalInfoForPatients
    }
}`

const updateHealthcareProfessionalMutation = `mutation test_updateHealthcareProfessional($id: ID!, $input: UpdateHealthcareProfessionalInput!) {
    updateHealthcareProfessional(id: $id, input: $input) {
        id
        names {
            lastName
            firstName
            middleName
            locale
        }
        degrees
        specialties
        facilityIds
        spokenLanguages
        createdDate
        updatedDate
        additionalInfoForPatients
    }
}`

const getHealthcareProfessionalByIdQuery = `query test_getHealthcareProfessionalById($id: ID!) {
    healthcareProfessional(id: $id) {
        id
        names {
            lastName
            firstName
            middleName
            locale
        }
        degrees
        specialties
        facilityIds
        spokenLanguages
        createdDate
        updatedDate
    }
}`

const searchHealthcareProfessionals = `query test_searchHealthcareProfessionals($filters: HealthcareProfessionalSearchFilters!) {
    healthcareProfessionals(filters: $filters) {
        id
        names { firstName lastName }
    }
}`

const searchHealthcareProfessionalsWithDetails = `query test_searchHealthcareProfessionalsWithDetails($filters: HealthcareProfessionalSearchFilters!) {
    healthcareProfessionals(filters: $filters) {
        id
        names { firstName lastName }
        degrees
        specialties
        spokenLanguages
    }
}`

const archiveProfessionalMutation = `mutation test_archiveHealthcareProfessional($id: ID!, $reason: String!) {
    archiveHealthcareProfessional(id: $id, reason: $reason) {
        id
        archivedAt
        archivedReason
        facilityIds
    }
}`

const unarchiveProfessionalMutation = `mutation test_unarchiveHealthcareProfessional($id: ID!) {
    unarchiveHealthcareProfessional(id: $id) {
        id
        archivedAt
    }
}`
