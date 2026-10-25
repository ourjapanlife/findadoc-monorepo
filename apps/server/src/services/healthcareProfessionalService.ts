import * as gqlTypes from '@findadoc/graphql'
import { ErrorCode, Result } from '../result.js'
import { validateProfessionalsSearchInput, validateUpdateProfessionalInput, validateCreateProfessionalInput } from '../validation/validationHealthcareProfessional.js'
import { validateIdInput } from '../validation/validateFacility.js'
import { logger } from '../logger.js'
import { createAuditLog } from './auditLogServiceSupabase.js'
import { db } from '../kyselyClient.js'
import { sql } from 'kysely'
import { asJsonb } from '../../utils/dbUtils.js'
import type { SelectQueryBuilder } from 'kysely'
import type { Database } from '../typeDefs/kyselyTypes.js'
import type { ProfessionalParent } from '../typeDefs/resolverParents.js'
import { likeContainsPattern, listQueryValue } from '../search/listQuery.js'
import { databaseOrderColumn, PROFESSIONAL_ORDER_COLUMNS } from '../search/orderColumn.js'
import { licenseColumnsForDegrees } from '../licenses/professionalLicense.js'
import { professionalFromRow, professionalWithFacilityIds } from '../services/mappersEntityService.js'
type StoredLicenseContext = {
    primaryLicense: string | null
    licenseReview: string | null
}

// Builds a partial update patch for Healthcare Professional rows.
export function buildHpUpdatePatch(
    fields: Partial<gqlTypes.UpdateHealthcareProfessionalInput>,
    stored?: StoredLicenseContext
) {
    const updatePatch: Record<string, unknown> = {}

    // JSONB columns must be wrapped with asJsonb(): the pg driver serializes raw JS
    // arrays as PostgreSQL array literals ({...}) which jsonb columns reject.
    if (fields.names !== undefined) { updatePatch.names = asJsonb(fields.names) }
    if (fields.licenseReview === gqlTypes.LicenseReviewStatus.Confirmed) {
        updatePatch.license_review = gqlTypes.LicenseReviewStatus.Confirmed
        updatePatch.license_recommendation = null
        if (fields.degrees !== undefined) {
            const confirmed = licenseColumnsForDegrees(fields.degrees, {
                confirmed: true,
                primaryLicense: stored?.primaryLicense,
                licenseReview: stored?.licenseReview
            })
            updatePatch.degrees = asJsonb(confirmed.degrees)
            updatePatch.primary_license = confirmed.primaryLicense
            updatePatch.additional_credentials = asJsonb(confirmed.additionalCredentials)
        }
    } else if (fields.degrees !== undefined) {
        const classified = licenseColumnsForDegrees(fields.degrees, {
            primaryLicense: stored?.primaryLicense,
            licenseReview: stored?.licenseReview
        })
        updatePatch.degrees = asJsonb(classified.degrees)
        updatePatch.primary_license = classified.primaryLicense
        updatePatch.additional_credentials = asJsonb(classified.additionalCredentials)
        const retainedPrimary = Boolean(stored?.primaryLicense && classified.primaryLicense === stored.primaryLicense)
        if (!retainedPrimary) {
            updatePatch.license_review = classified.licenseReview
            updatePatch.license_recommendation = classified.licenseRecommendation
        }
    }
    if (fields.spokenLanguages !== undefined) { updatePatch.spoken_languages = asJsonb(fields.spokenLanguages) }
    if (fields.specialties !== undefined) { updatePatch.specialties = asJsonb(fields.specialties) }
    if (fields.acceptedInsurance !== undefined) { updatePatch.accepted_insurance = asJsonb(fields.acceptedInsurance) }
    if (fields.additionalInfoForPatients !== undefined) {
        updatePatch.additional_info_for_patients = fields.additionalInfoForPatients
    }
    updatePatch.updated_date = new Date().toISOString()
    return updatePatch
}

// Applies JSONB array filters (degrees, specialties, languages, insurance) and the facility filter to an HP query.
export function applyHpFilters<O>(
  query: SelectQueryBuilder<Database, 'hps', O>,
  filters: gqlTypes.HealthcareProfessionalSearchFilters
): SelectQueryBuilder<Database, 'hps', O> {
    let filtered = query

    const queryText = listQueryValue(filters.query)
    if (queryText) { filtered = filtered.where('hps.search_text', 'ilike', likeContainsPattern(queryText)) }
    if (filters.degrees?.length) { filtered = filtered.where('hps.degrees', '@>', asJsonb(filters.degrees)) }
    if (filters.licenseReview) { filtered = filtered.where('hps.license_review', '=', filters.licenseReview) }
    if (filters.specialties?.length) { filtered = filtered.where('hps.specialties', '@>', asJsonb(filters.specialties)) }
    if (filters.spokenLanguages?.length) { filtered = filtered.where('hps.spoken_languages', '@>', asJsonb(filters.spokenLanguages)) }
    if (filters.acceptedInsurance?.length) { filtered = filtered.where('hps.accepted_insurance', '@>', asJsonb(filters.acceptedInsurance)) }
    // Keeps professionals linked to at least one of the facilities. facilityIds on the result are still loaded separately.
    const facilityIds = filters.facilityIds ?? []
    if (facilityIds.length) {
        filtered = filtered.where(eb => eb.exists(
            eb.selectFrom('hps_facilities')
                .select('hps_facilities.hps_id')
                .whereRef('hps_facilities.hps_id', '=', 'hps.id')
                .where('hps_facilities.facilities_id', 'in', facilityIds)
        ))
    }
    return filtered
}

/**
 * Loads the facility ids for each professional from the junction table in one query.
 * The per-request DataLoader in loaders.ts batches every professional in a response into one call.
 * @param hpIds Professional ids to look up.
 * @returns A map from professional id to its facility ids. A professional with none is not in the map.
 */
export async function facilityIdsByHpIds(hpIds: string[]): Promise<Map<string, string[]>> {
    const facilityIdsByHp = new Map<string, string[]>()

    if (!hpIds.length) {
        return facilityIdsByHp
    }

    const relations = await db
        .selectFrom('hps_facilities')
        .select(['hps_id', 'facilities_id'])
        .where('hps_id', 'in', hpIds)
        .execute()

    for (const relation of relations) {
        const list = facilityIdsByHp.get(relation.hps_id) ?? []

        list.push(relation.facilities_id)
        facilityIdsByHp.set(relation.hps_id, list)
    }

    return facilityIdsByHp
}

// Derives the facilityId to associate from relationship edits (create/delete).
export function resolveFacilityIdFromRelationships(
  relations: gqlTypes.Relationship[] | null | undefined
): { newFacilityId: string | null; error?: { field: string; httpStatus: number } } {
    if (!relations || relations.length === 0) {
        return {
            newFacilityId: null
        }
    }

    const creations = relations.filter(relation => relation.action === gqlTypes.RelationshipAction.Create)
    const deletions = relations.filter(relation => relation.action === gqlTypes.RelationshipAction.Delete)

    if (creations.length) { 
        return {
            newFacilityId: null,
            error: {
                field: 'facilityIds',
                httpStatus: 400
            } 
        }
    }
    if (creations.length === 0 && deletions.length > 0) {
        return { newFacilityId: null, error: { field: 'facilityIds', httpStatus: 400 } }
    }
    if (creations.length === 1) { 
        return {
            newFacilityId: creations[0].otherEntityId
        }
    }
    if (deletions.length) {
        return {
            newFacilityId: null
        }
    }
    return {
        newFacilityId: null
    }
}

/**
 * Gets the Healthcare Professional from the database that matches on the id.
 * @param id The id of the professional.
 * @returns A Healthcare Professional object, without its facility ids.
 */
export async function getHealthcareProfessionalById(
    id: string
): Promise<Result<ProfessionalParent>> {
    try {
        const validationResult = validateIdInput(id)

        if (validationResult.hasErrors) {
            logger.warn(`Validation Error: User passed invalid HP id: ${id}`)

            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: (validationResult.errors ?? []).map(err => ({
                    ...err,
                    field: 'getHealthcareProfessionalById'
                }))
            }
        }

        // Fetch the HP row by primary key
        const hpEntity = await db
            .selectFrom('hps')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        // A missing professional is the caller's to handle, not a server failure (and not a Sentry event).
        if (!hpEntity) {
            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: [{
                    field: 'getHealthcareProfessionalById',
                    errorCode: ErrorCode.NOT_FOUND,
                    httpStatus: 404
                }]
            }
        }

        // Convert database entity to GraphQL shape
        const gqlHealthcareProfessional = professionalFromRow(hpEntity)

        return {
            data: gqlHealthcareProfessional,
            hasErrors: false
        }
    } catch (error) {
        logger.error(`ERROR: Error retrieving healthcareProfessional by id ${id}: ${error}`)

        return {
            data: {} as gqlTypes.HealthcareProfessional,
            hasErrors: true,
            errors: [{
                field: 'getHealthcareProfessionalById',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Searches for a paginated list of HealthcareProfessionals based on various criteria.
 * - Facility filtering is an EXISTS on hps_facilities, so it stays in the main query.
 * - It applies scalar filters, ordering, and pagination to the main hps table.
 * @param filters Optional search and pagination filters for HP.
 * @returns A Promise that resolves to a Result object containing an array of HPs, without their facility ids.
 */
export async function searchProfessionals(
  filters: gqlTypes.HealthcareProfessionalSearchFilters = {}
): Promise<Result<ProfessionalParent[]>> {
    try {
        const validation = validateProfessionalsSearchInput(filters)

        if (validation.hasErrors) {
            return { data: [], hasErrors: true, errors: validation.errors }
        }

        if (Array.isArray(filters.ids) && filters.ids.length === 0) {
            return { data: [], hasErrors: false }
        }

        if (Array.isArray(filters.ids) && filters.ids.length) {
            const looksInvalid = filters.ids.some(id => !/^[0-9a-fA-F-]{36}$/.test(id))

            if (looksInvalid) {
                return { data: [], hasErrors: false }
            }
        }

        const limit = filters.limit ?? 20
        const offset = filters.offset ?? 0

        // Start base query on hps table and apply JSONB filters via helper
        let hpSelect = applyHpFilters(db.selectFrom('hps').selectAll('hps'), filters)

        if (Array.isArray(filters.ids)) {
            hpSelect = hpSelect.where('hps.id', 'in', filters.ids)
        }

        // Fallback to createdDate DESC.
        const orderBy = filters.orderBy?.[0]
        const orderColumn = databaseOrderColumn(orderBy?.fieldToOrder, PROFESSIONAL_ORDER_COLUMNS)

        if (orderColumn !== null) {
            hpSelect = hpSelect.orderBy(
                sql.ref(`hps.${orderColumn}`),
                orderBy?.orderDirection === 'desc' ? 'desc' : 'asc'
            )
        } else {
            hpSelect = hpSelect.orderBy('hps.created_date', 'desc')
        }

        // Perform paged fetch after all filters are applied so the page is computed
        const matchingHps = await hpSelect.limit(limit).offset(offset).execute()

        const result = matchingHps.map(hp => professionalFromRow(hp))

        return { data: result, hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: searchProfessionals ${JSON.stringify(filters)} -> ${err instanceof Error ? err.message : JSON.stringify(err)}`)
        return {
            data: [],
            hasErrors: true,
            errors: [{
                field: 'searchProfessionals',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Counts the total number of Healthcare Professionals (HP) matching the provided filters.
 * This function applies direct scalar filters to the professional data
 * and returns the exact count of the results.
 * @param filters An optional object of search filters for Healthcare Professionals.
 * @returns A Promise that resolves to a Result object containing the count (number) or errors.
 */
export async function countProfessionals(
  filters: gqlTypes.HealthcareProfessionalSearchFilters = {}
): Promise<Result<number>> {
    try {
        const validationResult = validateProfessionalsSearchInput(filters)

        if (validationResult.hasErrors) {
            return { data: 0, hasErrors: true, errors: validationResult.errors }
        }

        // Build a COUNT(*) query with the same JSONB-based filters used in the search endpoint.
        const countQuery = applyHpFilters(
            db.selectFrom('hps').select(eb => eb.fn.countAll<string>().as('count')),
            filters
        )

        // Postgres returns count(*) as a bigint string.
        const { count } = await countQuery.executeTakeFirstOrThrow()

        return { data: Number(count), hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: countProfessionals ${JSON.stringify(filters)} -> ${err}`)
        return {
            data: 0,
            hasErrors: true,
            errors: [{
                field: 'countProfessionals',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Creates a Healthcare Professional (HP) with Kysely transaction.
 * BUSINESS RULES:
 * - HP must be linked to EXACTLY ONE facility (enforced at creation)
 * - Multiple facilities not supported (returns validation error)
 * - Zero facilities not supported (returns validation error)
 * @param input - GraphQL CreateHealthcareProfessionalInput
 * @param updatedBy - User performing the creation (for audit)
 * @returns Result with created HealthcareProfessional or errors
 */
export async function createHealthcareProfessional(
    input: gqlTypes.CreateHealthcareProfessionalInput,
    updatedBy: string
): Promise<Result<gqlTypes.HealthcareProfessional>> {
    try {
        const licensed = licenseColumnsForDegrees(input.degrees)
        const createInput = { ...input, degrees: licensed.degrees }
        // Validate input before starting transaction
        const validationResult = validateCreateProfessionalInput(createInput)

        if (validationResult.hasErrors) {
            return validationResult as Result<gqlTypes.HealthcareProfessional>
        }

        // Business rule - validate facility IDs
        // HP must be linked to EXACTLY ONE facility
        const requestedFacilityIds: string[] = Array.isArray(input.facilityIds)
            ? (input.facilityIds as unknown[]).filter((facId): facId is string => typeof facId === 'string')
            : []

        // Enforce single facility rule multiple IDs are invalid input
        if (!requestedFacilityIds.length) {
            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: [{
                    field: 'facilityIds',
                    errorCode: ErrorCode.CREATEPROFFESIONAL_FACILITYIDS_REQUIRED,
                    httpStatus: 400
                }]
            }
        }

        if (requestedFacilityIds.length > 1) {
            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: [{
                    field: 'facilityIds',
                    errorCode: ErrorCode.INVALID_INPUT,
                    httpStatus: 400
                }]
            }
        }

        // Execute all operations in atomic transaction
        const gqlHealthcareProfessional = await db.transaction().execute(async transaction => {
            // Insert HP into hps table
            const insertedHp = await transaction
                .insertInto('hps')
                .values({
                    names: asJsonb(createInput.names),
                    degrees: asJsonb(licensed.degrees),
                    primary_license: licensed.primaryLicense,
                    additional_credentials: asJsonb(licensed.additionalCredentials),
                    license_review: licensed.licenseReview,
                    license_recommendation: licensed.licenseRecommendation,
                    specialties: asJsonb(createInput.specialties ?? []),
                    spoken_languages: asJsonb(input.spokenLanguages ?? []),
                    accepted_insurance: asJsonb(input.acceptedInsurance ?? []),
                    additional_info_for_patients: input.additionalInfoForPatients ?? null,
                    email: null,
                    created_date: new Date().toISOString(),
                    updated_date: new Date().toISOString()
                })
                .returningAll()
                .executeTakeFirstOrThrow()

            // Create HP-Facility relation
            // We know there's exactly one facility ID (validated above)
            const facilityId = requestedFacilityIds[0]

            await transaction
                .insertInto('hps_facilities')
                .values({
                    hps_id: insertedHp.id,
                    facilities_id: facilityId
                })
                .onConflict(oc => oc
                    .columns(['hps_id', 'facilities_id'])
                    .doNothing())
                .execute()

            // Map Kysely row to plain GraphQL object
            // CRITICAL: This removes Kysely's internal #props members
            const plainGqlHp = professionalWithFacilityIds(insertedHp, [facilityId])

            // Create audit log entry
            // Uses the same transaction (transaction) to ensure atomicity
            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Create,
                objectType: gqlTypes.ObjectType.HealthcareProfessional,
                updatedBy,
                newValue: plainGqlHp // Plain object is safe to serialize
            })

            // Return the plain GraphQL object from the transaction
            return plainGqlHp
        })

        // Transaction committed successfully
        logger.info(`DB-CREATE: Created healthcare professional ${gqlHealthcareProfessional.id}`)

        return {
            data: gqlHealthcareProfessional,
            hasErrors: false
        }
    } catch (error) {
        // Transaction was automatically rolled back
        // No HP, no relations, no audit log were created
        logger.error(`ERROR: Error creating healthcare professional: ${error}`)

        return {
            data: {} as gqlTypes.HealthcareProfessional,
            hasErrors: true,
            errors: [{
                field: 'createHealthcareProfessional',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Updates a Healthcare Professional with Kysely transaction.
 * - HP must always be linked to at least ONE facility
 * - Can update scalar fields (names, degrees, specialties, etc.)
 * - Can update facility relationship (but must keep at least one)
 * - All changes are atomic (scalar + relations + audit log)
 * @param id - HP ID to update
 * @param fieldsToUpdate - Partial update input from GraphQL
 * @param updatedBy - User performing the update (for audit)
 * @returns Result with updated HealthcareProfessional or errors
 */
export const updateHealthcareProfessional = async (
    id: string,
    fieldsToUpdate: Partial<gqlTypes.UpdateHealthcareProfessionalInput>,
    updatedBy: string
): Promise<Result<gqlTypes.HealthcareProfessional>> => {
    try {
        // Validate input before starting transaction
        const validationResult = validateUpdateProfessionalInput(fieldsToUpdate)

        if (validationResult.hasErrors) {
            return validationResult as Result<gqlTypes.HealthcareProfessional>
        }

        // Execute all operations in atomic transaction
        const gqlHealthcareProfessional = await db.transaction().execute(async transaction => {
            // Fetch current HP state
            const currentHp = await transaction
                .selectFrom('hps')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()

            if (!currentHp) {
                throw new Error('HP_NOT_FOUND')
            }

            // Fetch current facility relations
            const currentRelations = await transaction
                .selectFrom('hps_facilities')
                .select('facilities_id')
                .where('hps_id', '=', id)
                .execute()

            const currentFacilityIds = currentRelations.map(r => r.facilities_id)

            // Build update patch for scalar fields
            const updatePatch = buildHpUpdatePatch(fieldsToUpdate, {
                primaryLicense: currentHp.primary_license,
                licenseReview: currentHp.license_review
            })

            // Update scalar fields (always touch updatedDate)
            const hasChanges = Object.keys(updatePatch).length > 1 // More than just updatedDate

            let updatedHp = currentHp

            if (hasChanges) {
                updatedHp = await transaction
                    .updateTable('hps')
                    .set(updatePatch)
                    .where('id', '=', id)
                    .returningAll()
                    .executeTakeFirstOrThrow()
            } else {
                // Just touch updatedDate to track the change
                updatedHp = await transaction
                    .updateTable('hps')
                    .set({ updated_date: new Date().toISOString() })
                    .where('id', '=', id)
                    .returningAll()
                    .executeTakeFirstOrThrow()
            }

            // Handle facility relationship changes (if provided)
            let finalFacilityIds = currentFacilityIds

            if (fieldsToUpdate.facilityIds) {
                // Resolve new facility ID from relationship actions
                const { newFacilityId, error } = resolveFacilityIdFromRelationships(fieldsToUpdate.facilityIds ?? null)

                if (error) {
                    throw new Error('INVALID_FACILITY_RELATIONSHIP')
                }

                // Apply facility relationship change
                // This will delete all current relations and create the new one (if provided)
                if (newFacilityId === null) {
                    // User wants to delete the current facility
                    // Business rule: HP must have at least one facility
                    throw new Error('HP_REQUIRES_FACILITY')
                }

                // Delete all existing facility relations for this HP
                await transaction
                    .deleteFrom('hps_facilities')
                    .where('hps_id', '=', id)
                    .execute()

                // Insert new facility relation
                await transaction
                    .insertInto('hps_facilities')
                    .values({
                        hps_id: id,
                        facilities_id: newFacilityId
                    })
                    .onConflict(oc => oc
                        .columns(['hps_id', 'facilities_id'])
                        .doNothing())
                    .execute()

                finalFacilityIds = [newFacilityId]
            }

            // Map to GraphQL for audit log
            const oldGqlHp = professionalWithFacilityIds(currentHp, currentFacilityIds)
            const newGqlHp = professionalWithFacilityIds(updatedHp, finalFacilityIds)

            // Create audit log entry
            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Update,
                objectType: gqlTypes.ObjectType.HealthcareProfessional,
                updatedBy,
                oldValue: oldGqlHp,
                newValue: newGqlHp
            })

            // Return the updated GraphQL object
            return newGqlHp
        })

        // Transaction committed successfully
        logger.info(`DB-UPDATE: Updated healthcare professional ${id}`)

        return {
            data: gqlHealthcareProfessional,
            hasErrors: false
        }
    } catch (error) {
        const errorMessage = (error as Error).message

        // Handle HP_NOT_FOUND error
        if (errorMessage === 'HP_NOT_FOUND') {
            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: [{ 
                    field: 'id', 
                    errorCode: ErrorCode.INVALID_ID,
                    httpStatus: 404 
                }]
            }
        }

        // Handle INVALID_FACILITY_RELATIONSHIP error
        if (errorMessage === 'INVALID_FACILITY_RELATIONSHIP') {
            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: [{
                    field: 'facilityIds',
                    errorCode: ErrorCode.INVALID_INPUT,
                    httpStatus: 400
                }]
            }
        }

        // Handle HP_REQUIRES_FACILITY error
        if (errorMessage === 'HP_REQUIRES_FACILITY') {
            return {
                data: {} as gqlTypes.HealthcareProfessional,
                hasErrors: true,
                errors: [{
                    field: 'facilityIds',
                    errorCode: ErrorCode.INVALID_INPUT,
                    httpStatus: 400
                }]
            }
        }

        // Generic error
        logger.error(`ERROR: Error updating healthcareProfessional ${id}: ${error}`)
        return {
            data: {} as gqlTypes.HealthcareProfessional,
            hasErrors: true,
            errors: [{
                field: 'updateHealthcareProfessional',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Deletes a Healthcare Professional from the database.
 * - Fetch existing HP (validation)
 * - Delete HP (CASCADE automatically deletes hps_facilities relations)
 * - Create audit log
 * - All operations are atomic: if audit log fails, deletion is rolled back 
 * ON DELETE CASCADE:
 * The database schema has ON DELETE CASCADE on hps_facilities.hps_id,
 * so when we delete the HP, all relations are automatically deleted.
 * No need to manually delete from hps_facilities.
 * @param id - The ID of the professional to delete
 * @param updatedBy - User performing the deletion (for audit)
 * @returns Result indicating success or failure
 */
export async function deleteHealthcareProfessional(
    id: string,
    updatedBy: string
): Promise<Result<gqlTypes.DeleteResult>> {
    try {
        // Validate ID format before starting transaction
        const validationResult = validateIdInput(id)

        if (validationResult.hasErrors) {
            logger.warn(`Validation Error: invalid id for deleteHealthcareProfessional: ${id}`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: validationResult.errors
            }
        }

        // Execute deletion in atomic transaction
        await db.transaction().execute(async transaction => {
            // Fetch existing HP (for validation and audit log)
            const existingHp = await transaction
                .selectFrom('hps')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()

            if (!existingHp) {
                throw new Error('HP_NOT_FOUND')
            }

            // Fetch related facility IDs (for audit log)
            // Note: These will be automatically deleted by CASCADE,
            // but we need them for the audit log's oldValue
            const relations = await transaction
                .selectFrom('hps_facilities')
                .select('facilities_id')
                .where('hps_id', '=', id)
                .execute()

            const facilityIds = relations.map(row => row.facilities_id)

            // Delete the HP
            // CASCADE will automatically delete rows in hps_facilities
            await transaction
                .deleteFrom('hps')
                .where('id', '=', id)
                .execute()

            // Create audit log entry
            // Map Kysely row to GraphQL for audit log
            const oldGqlHp = professionalWithFacilityIds(existingHp, facilityIds)

            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Delete,
                objectType: gqlTypes.ObjectType.HealthcareProfessional,
                updatedBy,
                oldValue: oldGqlHp
            })
        })

        logger.info(`DB-DELETE: healthcare professional ${id} was deleted`)

        return {
            data: { isSuccessful: true },
            hasErrors: false
        }
    } catch (error) {
        const errorMessage = (error as Error).message

        // Handle HP_NOT_FOUND error
        if (errorMessage === 'HP_NOT_FOUND') {
            logger.warn(`deleteHealthcareProfessional: professional not found: ${id}`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: [{
                    field: 'deleteHealthcareProfessional',
                    errorCode: ErrorCode.INVALID_ID,
                    httpStatus: 404
                }]
            }
        }

        // Generic error
        logger.error(`ERROR: Error deleting professional ${id}: ${error}`)
        return {
            data: { isSuccessful: false },
            hasErrors: true,
            errors: [{
                field: 'deleteHealthcareProfessional',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Bulk updates HP-Facility relationships when a facility is modified.
 * USE CASE:
 * When a Facility is updated and its healthcareProfessionalIds change,
 * this function updates the junction table (hps_facilities) accordingly.
 * BUSINESS RULES:
 * - HP must always be linked to at least ONE facility
 * - Cannot delete a relation if it's the HP's last facility
 * - Batch validation: checks all HPs before making any changes
 * NOTE: No audit log in this function because it's called FROM updateFacility,
 * which already creates an audit log for the facility change.
 * 
 * @param professionalRelationshipsToUpdate - Array of relationship changes (CREATE/DELETE)
 * @param facilityId - The facility ID being linked/unlinked
 * @returns Result indicating success or validation errors
 */
export async function updateHealthcareProfessionalsWithFacilityIdChanges(
    professionalRelationshipsToUpdate: gqlTypes.Relationship[],
    facilityId: string
): Promise<Result<void>> {
    try {
        // Early return if no changes requested
        if (!professionalRelationshipsToUpdate || professionalRelationshipsToUpdate.length < 1) {
            return {
                data: undefined,
                hasErrors: false
            }
        }

        // Execute all operations in atomic transaction
        await db.transaction().execute(async transaction => {
            // Split relationships into CREATE vs DELETE
            const hpIdsToCreate: string[] = professionalRelationshipsToUpdate
                .filter(r => r.action === gqlTypes.RelationshipAction.Create)
                .map(r => r.otherEntityId)

            const hpIdsToDelete: string[] = professionalRelationshipsToUpdate
                .filter(r => r.action === gqlTypes.RelationshipAction.Delete)
                .map(r => r.otherEntityId)

            // Validation check if any HP would be left without facilities
            if (hpIdsToDelete.length) {
                // Batch query: count facilities for all HPs being deleted
                const facilityCounts = await transaction
                    .selectFrom('hps_facilities')
                    .select(['hps_id', expressionBuilder => 
                        expressionBuilder.fn.count<number>('facilities_id').as('count')
                    ])
                    .where('hps_id', 'in', hpIdsToDelete)
                    .groupBy('hps_id')
                    .execute()

                // Check if any HP would be left without facilities (count <= 1)
                const wouldBreak = facilityCounts
                    .filter(row => Number(row.count) <= 1)
                    .map(row => row.hps_id)

                if (wouldBreak.length) {
                    throw new Error('HP_REQUIRES_FACILITY')
                }
            }
            
            // Execute CREATE operations (if any)
            if (hpIdsToCreate.length > 0) {
                // Build rows for batch insert
                const relationsToCreate = hpIdsToCreate.map(hpId => ({
                    hps_id: hpId,
                    facilities_id: facilityId
                }))

                // Batch insert with idempotency
                await transaction
                    .insertInto('hps_facilities')
                    .values(relationsToCreate)
                    .onConflict(oc => oc
                        .columns(['hps_id', 'facilities_id'])
                        .doNothing())
                    .execute()
            }

            // Execute DELETE operations (if any)
            if (hpIdsToDelete.length) {
                // Batch delete - single query for all HPs
                await transaction
                    .deleteFrom('hps_facilities')
                    .where('facilities_id', '=', facilityId)
                    .where('hps_id', 'in', hpIdsToDelete)
                    .execute()
            }

            // Transaction commits here automatically if no errors
        })

        logger.info(`Bulk updated HP-Facility relations for facility ${facilityId}`)

        return {
            data: undefined,
            hasErrors: false
        }
    } catch (error) {
        const errorMessage = (error as Error).message

        // Handle HP_REQUIRES_FACILITY error
        if (errorMessage === 'HP_REQUIRES_FACILITY') {
            return {
                data: undefined,
                hasErrors: true,
                errors: [{
                    field: 'facilityIds',
                    errorCode: ErrorCode.INVALID_INPUT,
                    httpStatus: 400
                }]
            }
        }

        // Generic error
        logger.error(`Error updating healthcareProfessional facilityId list: ${error}`)
        return {
            data: undefined,
            hasErrors: true,
            errors: [{
                field: 'updateHealthcareprofessionalFacilityAssociations',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

