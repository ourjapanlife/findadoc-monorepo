import request from 'supertest'
import { expect, describe, test } from 'vitest'
import * as gqlType from '@findadoc/graphql'
import { gqlMutation, gqlRequest } from '../utils/gqlTool.js'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import { gqlApiUrl, sharedFacilityIds } from './testSetup.test.js'
import { createHealthcareProfessionalMutation } from './healthcareProfessional.test.js'
import { generateRandomCreateHealthcareProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { Error, ErrorCode } from '../src/result.js'
import { logger } from '../src/logger.js'

describe('createFacility', () => {
    test('creates a new Facility', async () => {
        const createFacilityRequest = {
            query: createFacilityMutation,
            variables: {
                input: generateRandomCreateFacilityInput() satisfies gqlType.CreateFacilityInput
            }
        } as gqlMutation<gqlType.CreateFacilityInput>

        const createFacilityResult = await request(gqlApiUrl).post('').send(createFacilityRequest)

        //should not have errors
        expect(createFacilityResult.body.errors).toBeUndefined()

        const originalInputValues = createFacilityRequest.variables.input
        const newFacility = createFacilityResult.body.data.createFacility as gqlType.Facility

        const getFacilityByIdRequest = {
            query: getFacilityByIdQuery,
            variables: {
                id: newFacility.id
            }
        } as gqlRequest

        // Query the facility by id
        const getFacilityResult = await request(gqlApiUrl).post('').send(getFacilityByIdRequest)

        //should not have errors
        const errors = createFacilityResult.body?.errors

        if (errors) {
            logger.error(createFacilityResult.body.errors)
        }
        expect(errors).toBeUndefined()

        const searchedFacility = getFacilityResult.body.data.facility as gqlType.Facility

        expect(searchedFacility.contact).toEqual(originalInputValues.contact)
        expect(searchedFacility.id).toBeDefined()
        expect(searchedFacility.createdDate).toBeDefined()
        expect(searchedFacility.updatedDate).toBeDefined()
        expect(searchedFacility.nameEn).toBe(originalInputValues.nameEn)
        expect(searchedFacility.nameJa).toBe(originalInputValues.nameJa)
        expect(searchedFacility.mapLatitude).toBe(originalInputValues.mapLatitude)
        expect(searchedFacility.mapLongitude).toBe(originalInputValues.mapLongitude)
    })

    test('facility/healthcareprofessional associations: Creating healthcareprofessional updates facility\'s healthcareProfessionalIds', async () => {
        //// Step 1: Create a new facility that has the sharedFacilityIds.
        const createHealthcareProfessionalRequest = {
            query: createHealthcareProfessionalMutation,
            variables: {
                 
                input: {
                    ...generateRandomCreateHealthcareProfessionalInput(),
                    facilityIds: sharedFacilityIds
                } satisfies gqlType.CreateHealthcareProfessionalInput
            }
        } as gqlMutation<gqlType.CreateHealthcareProfessionalInput>

        // Create a new healthcare professional with the associated facility id
        const createProfessionalResult = await request(gqlApiUrl).post('').send(createHealthcareProfessionalRequest)

        //should not have errors
        const createdErrors = createProfessionalResult.body.errors

        if (createdErrors) {
            logger.error(JSON.stringify(createdErrors))
            expect(createdErrors).toBeUndefined()
        }
        const createdProfessional =
            createProfessionalResult.body.data.createHealthcareProfessional as gqlType.HealthcareProfessional

        // The healthcare professional should have the facility ids that we provided.
        expect(createdProfessional).toBeDefined()
        expect(createdProfessional.facilityIds).toBeDefined()
        expect(createdProfessional.facilityIds).containSubset(sharedFacilityIds)

        const getFacilityByIdRequest = {
            query: getFacilityByIdQuery,
            variables: {
                id: sharedFacilityIds[0]
            }
        } as gqlRequest

        //// Step 2: Query the facility by id and check if it has the new healthcare professional id added to it.
        const getFacilityResult = await request(gqlApiUrl).post('').send(getFacilityByIdRequest)

        //should not have errors
        const errors = getFacilityResult.body?.errors

        if (errors) {
            logger.error(JSON.stringify(errors))
            expect(errors).toBeUndefined()
        }

        const searchedFacility = getFacilityResult.body.data.facility as gqlType.Facility

        // The healthcare professional should have the facility ids that we provided.
        expect(searchedFacility.healthcareProfessionalIds).toBeDefined()
        expect(searchedFacility.healthcareProfessionalIds).toContain(createdProfessional.id)
    })
})

describe('getFacilityById', () => {
    test('gets the Facility that matches the facility_id', async () => {
        const createFacilityRequest = {
            query: createFacilityMutation,
            variables: {
                input: generateRandomCreateFacilityInput() satisfies gqlType.CreateFacilityInput
            }
        } as gqlMutation<gqlType.CreateFacilityInput>

        // Create a new facility
        const newFacilityResult = await request(gqlApiUrl).post('').send(createFacilityRequest)

        //should not have errors
        const errors = newFacilityResult.body?.errors

        if (errors) {
            logger.error(newFacilityResult.body.errors)
        }
        expect(errors).toBeUndefined()

        // Get the ID of the new facility
        const newFacility = newFacilityResult.body.data.createFacility as gqlType.Facility

        const getFacilityByIdRequest = {
            query: getFacilityByIdQuery,
            variables: {
                id: newFacility.id
            }
        } as gqlRequest

        // Query the facility by id
        const getFacilityResult = await request(gqlApiUrl).post('').send(getFacilityByIdRequest)

        //should not have errors
        expect(getFacilityResult.body?.errors).toBeUndefined()

        // Compare the actual data returned by getFacilityById to the new facility stored in the database
        const searchedFacility = getFacilityResult.body.data.facility as gqlType.Facility
        const originalInputValues = createFacilityRequest.variables.input

        expect(searchedFacility.id).toBe(newFacility.id)
        expect(searchedFacility.nameEn).toBe(originalInputValues.nameEn)
        expect(searchedFacility.nameJa).toBe(originalInputValues.nameJa)
        expect(searchedFacility.contact).toEqual(originalInputValues.contact)
        expect(searchedFacility.createdDate).toBeDefined()
        expect(searchedFacility.updatedDate).toBeDefined()
        expect(searchedFacility.paymentOptions).toBeDefined()
    })
})

describe('updateFacility', () => {
    test('updates various Facility fields', async () => {
        // Create a new facility
        const createFacilityRequest = {
            query: createFacilityMutation,
            variables: {
                input: generateRandomCreateFacilityInput() satisfies gqlType.CreateFacilityInput
            }
        } as gqlMutation<gqlType.CreateFacilityInput>
        const newFacilityResult = await request(gqlApiUrl).post('').send(createFacilityRequest)

        //should not have errors
        const errors = newFacilityResult.body?.errors

        if (errors) {
            logger.error(JSON.stringify(errors))
            expect(JSON.stringify(errors)).toBeUndefined()
        }

        // Get the ID of the new facility
        const newFacility = newFacilityResult.body.data.createFacility as gqlType.Facility

        const updateInput = generateRandomCreateFacilityInput()
        const updateFacilityMutationRequest = {
            query: updateFacilityMutation,
            variables: {
                id: newFacility.id,
                input: {
                    ...updateInput,
                    contact: { ...updateInput.contact, phone: '０３ ５７２２-５５００' },
                    healthcareProfessionalIds: []
                } satisfies gqlType.UpdateFacilityInput
            }
        } as gqlMutation<gqlType.UpdateFacilityInput>

        // Mutation to update the facility
        const updateFacilityResult = await request(gqlApiUrl).post('').send(updateFacilityMutationRequest)

        //should not have errors
        const updateErrors = updateFacilityResult.body?.errors

        if (updateErrors) {
            logger.error(JSON.stringify(updateErrors))
            expect(JSON.stringify(updateErrors)).toBeUndefined()
        }

        const getFacilityByIdRequest = {
            query: getFacilityByIdQuery,
            variables: {
                id: newFacility.id
            }
        } as gqlRequest

        // fetch the updated facility
        const getFacilityResult = await request(gqlApiUrl).post('').send(getFacilityByIdRequest)

        //should not have errors
        const queryErrors = getFacilityResult.body?.errors

        if (queryErrors) {
            logger.error(JSON.stringify(queryErrors))
            expect(JSON.stringify(queryErrors)).toBeUndefined()
        }

        // Compare the actual updated facility returned by getFacilityById to the update request we sent
        const updatedFacility = getFacilityResult.body.data.facility as gqlType.Facility
        const fieldsThatWereUpdated = updateFacilityMutationRequest.variables.input

        expect(updatedFacility.id).toBe(newFacility.id)
        expect(updatedFacility.nameEn).toBe(fieldsThatWereUpdated.nameEn)
        expect(updatedFacility.nameJa).toBe(fieldsThatWereUpdated.nameJa)
        // Any spacing or full-width digits on input; E.164 in storage.
        expect(updatedFacility.contact.phone).toBe('+81357225500')
        expect(updatedFacility.createdDate).toBeDefined()
        expect(updatedFacility.updatedDate).toBeDefined()
    })
})

describe('archiveFacility', () => {
    test('hides a facility from public reads, keeps the record, and unarchives it', async () => {
        const createFacilityResult = await request(gqlApiUrl).post('').send({
            query: createFacilityMutation,
            variables: { input: generateRandomCreateFacilityInput() satisfies gqlType.CreateFacilityInput }
        })
        expect(createFacilityResult.body?.errors).toBeUndefined()
        const facilityId = (createFacilityResult.body.data.createFacility as gqlType.Facility).id
        const getFacilityByIdRequest = { query: getFacilityByIdQuery, variables: { id: facilityId } } as gqlRequest

        const tooLong = await request(gqlApiUrl).post('').send({
            query: archiveFacilityMutation,
            variables: { id: facilityId, reason: 'x'.repeat(501) }
        })
        const tooLongErrors = tooLong.body?.errors[0].extensions.errors as Error[]
        expect(tooLongErrors).toEqual([
            { field: 'reason', errorCode: ErrorCode.INVALID_LENGTH_TOO_LONG, httpStatus: 400 }
        ])

        const archived = await request(gqlApiUrl).post('').send({
            query: archiveFacilityMutation,
            variables: { id: facilityId, reason: 'Clinic closed' }
        })
        expect(archived.body?.errors).toBeUndefined()
        expect(archived.body.data.archiveFacility.archivedAt).toBeTruthy()
        // The test user cannot edit facilities, so the moderator note stays hidden.
        expect(archived.body.data.archiveFacility.archivedReason).toBeNull()

        // A public read by id behaves like a deleted facility.
        const missing = await request(gqlApiUrl).post('').send(getFacilityByIdRequest)
        const missingErrors = missing.body?.errors[0].extensions.errors as Error[]
        expect(missingErrors).toHaveLength(1)
        expect(missingErrors[0].field).toBe('getFacilityById')
        expect(missingErrors[0].errorCode).toBe(ErrorCode.NOT_FOUND)

        const listed = await request(gqlApiUrl).post('').send({
            query: searchFacilitiesQuery,
            variables: { filters: { query: facilityId } }
        })
        expect(listed.body.data.facilities).toEqual([])

        // Only a moderator may ask for archived records.
        const archivedList = await request(gqlApiUrl).post('').send({
            query: searchFacilitiesQuery,
            variables: { filters: { query: facilityId, archive: gqlType.ArchiveFilter.All } }
        })
        expect(archivedList.body?.errors[0].extensions.code).toBe('UNAUTHORIZED')

        const restored = await request(gqlApiUrl).post('').send({
            query: unarchiveFacilityMutation,
            variables: { id: facilityId }
        })
        expect(restored.body?.errors).toBeUndefined()
        expect(restored.body.data.unarchiveFacility.archivedAt).toBeNull()

        const restoredAgain = await request(gqlApiUrl).post('').send({
            query: unarchiveFacilityMutation,
            variables: { id: facilityId }
        })
        const notArchived = restoredAgain.body?.errors[0].extensions.errors as Error[]
        expect(notArchived[0].errorCode).toBe(ErrorCode.NOT_ARCHIVED)

        const found = await request(gqlApiUrl).post('').send(getFacilityByIdRequest)
        expect(found.body?.errors).toBeUndefined()
        expect(found.body.data.facility.id).toBe(facilityId)
    })
})

export const createFacilityMutation = `mutation test_createFacility($input: CreateFacilityInput!) {
    createFacility(input: $input) {
        id
        contact {
            address {
                addressLine1En
                addressLine1Ja
                addressLine2En
                addressLine2Ja
                cityEn
                cityJa
                postalCode
                prefectureEn
                prefectureJa
            }
            googleMapsUrl
            email
            phone
            website
        }
        healthcareProfessionalIds
        supportedLanguages
        mapLatitude
        mapLongitude
        nameEn
        nameJa
        createdDate
        updatedDate
        paymentOptions {
            paymentType
            paymentBrands
        }
    }
}`

const updateFacilityMutation = `mutation test_updateFacility($id: ID!, $input: UpdateFacilityInput!) {
    updateFacility(id: $id, input: $input) {
        id
        nameEn
        nameJa
        contact {
            googleMapsUrl
            email
            phone
            website
            address {
                postalCode
                prefectureEn
                cityEn
                addressLine1En
                addressLine2En
                prefectureJa
                cityJa
                addressLine1Ja
                addressLine2Ja
            }
        }
        mapLatitude
        mapLongitude
        healthcareProfessionalIds
        createdDate
        updatedDate
        paymentOptions {
            paymentType
            paymentBrands
        }
    }
}`

const archiveFacilityMutation = `mutation test_archiveFacility($id: ID!, $reason: String!) {
    archiveFacility(id: $id, reason: $reason) {
        id
        archivedAt
        archivedReason
    }
}`

const unarchiveFacilityMutation = `mutation test_unarchiveFacility($id: ID!) {
    unarchiveFacility(id: $id) {
        id
        archivedAt
    }
}`

const getFacilityByIdQuery = `query test_getfacilityById($id: ID!) {
    facility(id: $id) {
        id
        nameEn
        nameJa
        contact {
            googleMapsUrl
            email
            phone
            website
            address {
                postalCode
                prefectureEn
                cityEn
                addressLine1En
                addressLine2En
                prefectureJa
                cityJa
                addressLine1Ja
                addressLine2Ja
            }
        }
        mapLatitude
        mapLongitude
        healthcareProfessionalIds
        createdDate
        updatedDate
        paymentOptions {
            paymentType
            paymentBrands
        }
    }
}`

const searchFacilitiesQuery = `query test_searchArchivedFacilities($filters: FacilitySearchFilters!) {
    facilities(filters: $filters) {
        id
    }
}`
