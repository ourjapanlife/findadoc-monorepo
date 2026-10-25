import * as gqlTypes from '@findadoc/graphql'
import { ErrorCode, Result, type Error as ValidationError } from '../result.js'
import {
    isValidHpInput,
    validateApprovalProfessionalFields,
    validateCreateSubmissionInputs,
    validateIdInput,
    validateSubmissionSearchFilters,
    validateUpdateSubmissionInput
} from '../validation/validateSubmissions.js'
import { logger } from '../logger.js'
import { createAuditLog } from './auditLogServiceSupabase.js'
import { sql, type SelectQueryBuilder, type Transaction } from 'kysely'
import type { Database } from '../typeDefs/kyselyTypes.js'
import { SUBMISSION_STATUS, type SubmissionStatusEnum, type SubmissionsTable } from '../typeDefs/kyselyTypes.js'
import type { Selectable } from 'kysely'
import { db } from '../kyselyClient.js'
import { submissionFromRow } from '../services/mappersEntityService.js'
import { asJsonb } from '../../utils/dbUtils.js'
import { licenseColumnsForDegrees } from '../licenses/professionalLicense.js'
import { canonicalMapsFields } from '../places/mapsLink.js'
import { isPublishedLocale, uniqueLocales } from '../languages/publishedLocales.js'
import { databaseOrderColumn, SUBMISSION_ORDER_COLUMNS } from '../search/orderColumn.js'
import { contactForStorage } from './facilityService.js'
type SubmissionStatusFlag = keyof Pick<
    gqlTypes.SubmissionSearchFilters,
    'isUnderReview' | 'isApproved' | 'isRejected'
>

type SubmissionStatusFlags = Partial<Pick<gqlTypes.SubmissionSearchFilters, SubmissionStatusFlag>>

class SubmissionApprovalValidationError extends Error {
    readonly validationErrors: ValidationError[]

    constructor(validationErrors: ValidationError[]) {
        super('APPROVAL_VALIDATION')
        this.validationErrors = validationErrors
    }
}

/**
 * Maps GraphQL status flags to DB status values.
 * Shared by search filters and submission updates.
 */
const SUBMISSION_STATUS_FILTERS: ReadonlyArray<
    readonly [SubmissionStatusFlag, SubmissionStatusEnum]
> = [
    ['isUnderReview', SUBMISSION_STATUS.UNDER_REVIEW],
    ['isApproved', SUBMISSION_STATUS.APPROVED],
    ['isRejected', SUBMISSION_STATUS.REJECTED]
]

/** Partial-match filters applied with ilike on the submissions table. */
const SUBMISSION_ILIKE_QUERY_FILTERS = [
    { flag: 'googleMapsUrl' as const, column: 'google_maps_url' },
    { flag: 'healthcareProfessionalName' as const, column: 'healthcare_professional_name' }
] as const

/** Exact-match filters applied with eq on the submissions table. */
const SUBMISSION_EQ_QUERY_FILTERS = [
    { flag: 'createdDate' as const, column: 'created_date' },
    { flag: 'updatedDate' as const, column: 'updated_date' }
] as const

/** Scalar fields copied directly onto a submission update patch. */
const SUBMISSION_SCALAR_UPDATE_FIELDS = [
    ['googleMapsUrl', 'google_maps_url'],
    ['healthcareProfessionalName', 'healthcare_professional_name'],
    ['notes', 'notes']
] as const satisfies ReadonlyArray<
    readonly [keyof gqlTypes.UpdateSubmissionInput, string]
>

/**
 * Resolves at most one DB status from GraphQL boolean status flags.
 * Single-pass: O(n) with no intermediate arrays.
 */
function resolveSubmissionStatusFilter(
    flags: SubmissionStatusFlags,
    onConflict?: () => never
): SubmissionStatusEnum | undefined {
    let resolved: SubmissionStatusEnum | undefined

    for (const [flag, status] of SUBMISSION_STATUS_FILTERS) {
        if (!flags[flag]) {
            continue
        }

        if (resolved) {
            if (onConflict) {
                onConflict()
            }

            throw Object.assign(new Error('Conflicting status filters'), { httpStatus: 400 })
        }

        resolved = status
    }

    return resolved
}

function buildSubmissionUpdatePatch(
    currentStatus: SubmissionStatusEnum,
    fieldsToUpdate: Partial<gqlTypes.UpdateSubmissionInput>
): Record<string, unknown> {
    const patch: Record<string, unknown> = {
        updated_date: new Date().toISOString(),
        status: resolveSubmissionStatusFilter(fieldsToUpdate, () => {
            throw new Error('INVALID_INPUT')
        }) ?? currentStatus
    }

    for (const [inputField, column] of SUBMISSION_SCALAR_UPDATE_FIELDS) {
        const value = fieldsToUpdate[inputField]

        if (value !== undefined) {
            patch[column] = value
        }
    }

    if (fieldsToUpdate.spokenLanguages !== undefined) {
        patch.spoken_languages = asJsonb<gqlTypes.Locale[]>(fieldsToUpdate.spokenLanguages ?? [])
    }

    if (fieldsToUpdate.healthcareProfessionals !== undefined) {
        patch.healthcare_professionals_partial = asJsonb(fieldsToUpdate.healthcareProfessionals ?? [])
    }

    if (fieldsToUpdate.facility !== undefined) {
        const facility = fieldsToUpdate.facility
        // Contact.googleMapsUrl is non-null on FacilitySubmission. Normalize so a
        // ContactInput that omits address or Maps URL still round-trips.
        patch.facility_partial = asJsonb(facility
            ? {
                ...facility,
                contact: contactForStorage(facility.contact, {
                    clearLocation: facility.online === true
                })
            }
            : null)
    }

    return patch
}

/**
 * Builds a minimal, empty address object.
 * Used when a submission does not contain address details,
 * but a complete shape is required to avoid null references.
 */
function createBlankAddress(): gqlTypes.PhysicalAddressInput {
    return {
        addressLine1En: '',
        addressLine2En: '',
        addressLine1Ja: '',
        addressLine2Ja: '',
        cityEn: '',
        cityJa: '',
        prefectureEn: '',
        prefectureJa: '',
        postalCode: ''
    }
}

/**
 * Builds a minimal contact object.
 * Ensures all required fields are defined, even if empty.
 * @param googleMapsUrl Optional pre-filled Google Maps URL.
 */

async function canonicalizeSubmissionMapsUrls(
    fields: Partial<gqlTypes.UpdateSubmissionInput>
): Promise<Partial<gqlTypes.UpdateSubmissionInput>> {
    const resolved = new Map<string, string>()
    const storedUrl = async (url: string) => {
        const key = url.trim()
        const cached = resolved.get(key)
        if (cached !== undefined) { return cached }
        const maps = await canonicalMapsFields(key)
        resolved.set(key, maps.url)
        return maps.url
    }

    const next: Partial<gqlTypes.UpdateSubmissionInput> = { ...fields }
    if (typeof next.googleMapsUrl === 'string') {
        next.googleMapsUrl = await storedUrl(next.googleMapsUrl)
    }
    if (next.facility?.contact) {
        next.facility = {
            ...next.facility,
            contact: {
                ...next.facility.contact,
                googleMapsUrl: await storedUrl(next.facility.contact.googleMapsUrl ?? '')
            }
        }
    }
    return next
}

function mapsUrlForApprovalFacility(submission: {
    google_maps_url: string | null
    facility_partial: gqlTypes.FacilitySubmission | null
}): string {
    if (submission.facility_partial) {
        return (submission.facility_partial as gqlTypes.CreateFacilityInput).contact?.googleMapsUrl ?? ''
    }
    return submission.google_maps_url ?? ''
}

function createBlankContact(googleMapsUrl?: string): gqlTypes.ContactInput {
    return {
        address: createBlankAddress(),
        email: '',
        phone: '',
        website: '',
        googleMapsUrl: googleMapsUrl ?? ''
    }
}

/**
 * Deduplicates and sanitizes a list of locale codes.
 * Removes null/undefined entries and returns unique Locale values.
 * @param locales Possibly null or undefined list of Locale values.
 * @returns Array of unique, valid locales.
 */
function sanitizeLocales(locales: (gqlTypes.Locale | null | undefined)[] | null | undefined): gqlTypes.Locale[] {
    if (!locales) { return [] }
    // Filter out null/undefined entries
    const clean = locales.filter((local): local is gqlTypes.Locale => !!local)

    return Array.from(new Set(clean))
}

/**
 * Splits a full name string into first, last, and optional middle name parts.
 * If only one part is found, assigns 'Unknown' as a fallback last name.
 * @example
 * splitPersonName("John Smith") → { firstName: "John", lastName: "Smith" }
 * splitPersonName("Madonna") → { firstName: "Madonna", lastName: "Unknown" }
 */
function splitPersonName(full: string): { firstName: string; lastName: string; middleName?: string } {
    // Split by any whitespace and remove empty parts
    const parts = full.trim().split(/\s+/).filter(Boolean)

    if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'Unknown' }
    }
    if (parts.length === 2) {
        return { firstName: parts[0], lastName: parts[1] }
    }
    // For 3+ parts: treat the first as firstName, last as lastName, and join the rest as middleName
    return {
        firstName: parts[0],
        lastName: parts[parts.length - 1],
        middleName: parts.slice(1, -1).join(' ')
    }
}

/**
 * Applies filtering logic to a query on the `submissions` table.
 * Filter definitions live in SUBMISSION_*_QUERY_FILTERS and SUBMISSION_STATUS_FILTERS.
 */
function applySubmissionQueryFilters<O>(
  queryBuilder: SelectQueryBuilder<Database, 'submissions', O>,
  filters: gqlTypes.SubmissionSearchFilters
): SelectQueryBuilder<Database, 'submissions', O> {
    let query = queryBuilder

    for (const { flag, column } of SUBMISSION_ILIKE_QUERY_FILTERS) {
        const value = filters[flag]

        if (value) {
            query = query.where(column, 'ilike', `%${value}%`)
        }
    }

    const status = resolveSubmissionStatusFilter(filters)

    if (status) {
        query = query.where('status', '=', status)
    }

    for (const { flag, column } of SUBMISSION_EQ_QUERY_FILTERS) {
        const value = filters[flag]

        if (value) {
            query = query.where(column, '=', value)
        }
    }

    return query
}

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Gets the Submission from the database that matches the id.
 * @param id The ID of the Submission row in the database.
 * @returns A Submission object.
 */
export const getSubmissionById = async (
    id: string
): Promise<Result<gqlTypes.Submission>> => {
    try {
        // An id that is not a uuid cannot match a row. It is NOT_FOUND, not a database error.
        const submissionRow = UUID_PATTERN.test(id)
            ? await db
                .selectFrom('submissions')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()
            : undefined

        if (!submissionRow) {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: [{ field: 'id', errorCode: ErrorCode.NOT_FOUND, httpStatus: 404 }]
            }
        }

        // Map DB → GQL
        const gqlSubmission = submissionFromRow(submissionRow)

        return { data: gqlSubmission, hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: Error retrieving submission by id ${id}: ${err}`)
        return {
            data: {} as gqlTypes.Submission,
            hasErrors: true,
            errors: [{
                field: 'getSubmissionById',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Searches for submissions in the database based on provided filters.
 * Returns a paginated list of submissions.
 * This function is designed to serve the GraphQL query that returns only the array of submissions.
 * @param filters The search filters to apply.
 * @returns An object containing data (an array of GraphQL Submissions)
 */
export async function searchSubmissions(
  filters: gqlTypes.SubmissionSearchFilters = {}
): Promise<Result<gqlTypes.Submission[]>> {
    try {
        const validation = validateSubmissionSearchFilters(filters)

        if (validation.hasErrors) {
            return { data: [], hasErrors: true, errors: validation.errors }
        }

        const limit = filters.limit ?? 20
        const offset = filters.offset ?? 0

        let base = applySubmissionQueryFilters(db.selectFrom('submissions').selectAll(), filters)

        const orderBy = filters.orderBy?.[0]
        const orderColumn = databaseOrderColumn(orderBy?.fieldToOrder, SUBMISSION_ORDER_COLUMNS)

        if (orderColumn !== null) {
            base = base.orderBy(sql.ref(orderColumn), orderBy?.orderDirection === 'desc' ? 'desc' : 'asc')
        } else {
            base = base.orderBy('created_date', 'desc')
        }

        // Apply pagination
        const rows = await base.limit(limit).offset(offset).execute()

        // Convert DB → GQL
        let listSubmissions = rows.map(row => submissionFromRow(row))

        const langs = (filters.spokenLanguages ?? []).filter((l): l is gqlTypes.Locale => !!l)

        if (langs.length > 0) {
            listSubmissions = listSubmissions.filter(sub =>
                (sub.spokenLanguages ?? []).some(l => langs.includes(l)))
        }

        return { data: listSubmissions, hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: searchSubmissions ${JSON.stringify(filters)} -> ${err}`)
        return {
            data: [],
            hasErrors: true,
            errors: [{
                field: 'searchSubmissions',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Gets the total count of submissions matching the given filters.
 * Reuses applySubmissionQueryFilters so count and search stay in sync.
 */
export async function countSubmissions(
  filters: gqlTypes.SubmissionSearchFilters = {}
): Promise<Result<number>> {
    try {
        const validation = validateSubmissionSearchFilters(filters)

        if (validation.hasErrors) {
            return { data: 0, hasErrors: true, errors: validation.errors }
        }

        // Apply the same filtering logic as searchSubmissions
        const { count } = await applySubmissionQueryFilters(
            db.selectFrom('submissions').select(eb => eb.fn.countAll<string>().as('count')),
            filters
        ).executeTakeFirstOrThrow()

        // Postgres returns count(*) as a bigint string.
        return { data: Number(count), hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: countSubmissions ${JSON.stringify(filters)} -> ${err}`)
        return {
            data: 0,
            hasErrors: true,
            errors: [{
                field: 'countSubmissions',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

export const createSubmission = async (
    submissionInput: gqlTypes.CreateSubmissionInput,
    updatedBy: string
): Promise<Result<gqlTypes.Submission>> => {
    try {
        const validationResults = validateCreateSubmissionInputs(submissionInput)

        // Filter out validation errors related to ID (not user-supplied)
        const filteredErrors = (validationResults.errors ?? []).filter(e => e.field !== 'id')

        if (validationResults.hasErrors && filteredErrors.length > 0) {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: filteredErrors
            }
        }

        const mapsUrl = await canonicalMapsFields(submissionInput.googleMapsUrl)

        const gqlSubmission = await db.transaction().execute(async transaction => {
            // Insert submission
            const insertedSubmission = await transaction
                .insertInto('submissions')
                .values({
                    status: SUBMISSION_STATUS.PENDING,
                    google_maps_url: mapsUrl.url,
                    healthcare_professional_name: submissionInput.healthcareProfessionalName ?? '',
                    spoken_languages: asJsonb<gqlTypes.Locale[]>(submissionInput.spokenLanguages ?? []),
                    facility_partial: null,
                    healthcare_professionals_partial: null,
                    hps_id: null,
                    facilities_id: null,
                    notes: submissionInput.notes ?? null,
                    created_date: new Date().toISOString(),
                    updated_date: new Date().toISOString()
                })
                .returningAll()
                .executeTakeFirstOrThrow()

            // Map to GraphQL
            const plainGqlSubmission = submissionFromRow(insertedSubmission)
            
            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Create,
                objectType: gqlTypes.ObjectType.Submission,
                updatedBy,
                newValue: plainGqlSubmission
            })

            return plainGqlSubmission
        })

        logger.info(`DB-CREATE: submission ${gqlSubmission.id} created`)
        return { data: gqlSubmission, hasErrors: false }
    } catch (error) {
        logger.error(`ERROR: Error creating submission: ${error}`)
        return {
            data: {} as gqlTypes.Submission,
            hasErrors: true,
            errors: [{
                field: 'createSubmission',
                errorCode: ErrorCode.SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Updates a submission record in the database.
 *
 * If isApproved=true, this redirects to approveSubmission() before the transaction.
 *
 * TRANSACTION BEHAVIOR:
 * - Throws NOT_FOUND or INVALID_INPUT to signal specific failures
 * - These are caught in the outer catch block and converted to proper Result objects
 * - This pattern avoids multiple return statements inside the transaction
 */
export const updateSubmission = async (
    submissionId: string,
    fieldsToUpdate: Partial<gqlTypes.UpdateSubmissionInput>,
    updatedBy: string
): Promise<Result<gqlTypes.Submission>> => {
    try {
        const validation = validateUpdateSubmissionInput(fieldsToUpdate)

        if (validation.hasErrors) {
            logger.warn(`Validation failed for updateSubmission: ${JSON.stringify(validation.errors)}`)
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: validation.errors
            }
        }

        const fields = await canonicalizeSubmissionMapsUrls(fieldsToUpdate)

        // Redirect to approveSubmission if isApproved flag is set
        if (fields.isApproved === true) {
            return await approveSubmission(submissionId, updatedBy)
        }

        const gqlSubmission = await db.transaction().execute(async transaction => {
            // Load the current submission state
            const currentSubmission = await transaction
                .selectFrom('submissions')
                .selectAll()
                .where('id', '=', submissionId)
                .executeTakeFirst()

            if (!currentSubmission) {
                throw new Error('NOT_FOUND')
            }

            // Map boolean flags to status via SUBMISSION_STATUS_FILTERS
            const patch = buildSubmissionUpdatePatch(currentSubmission.status, fields)

            const updatedSubmission = await transaction
                .updateTable('submissions')
                .set(patch)
                .where('id', '=', submissionId)
                .returningAll()
                .executeTakeFirstOrThrow()

            // Map to GraphQL for audit log
            const oldGqlSubmission = submissionFromRow(currentSubmission)
            const newGqlSubmission = submissionFromRow(updatedSubmission)

            // Create audit log entry
            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Update,
                objectType: gqlTypes.ObjectType.Submission,
                updatedBy,
                oldValue: oldGqlSubmission,
                newValue: newGqlSubmission
            })

            return newGqlSubmission
        })

        return { data: gqlSubmission, hasErrors: false }
    } catch (error) {
        const errorMessage = (error as Error).message

        // Handle NOT_FOUND error
        if (errorMessage === 'NOT_FOUND') {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: [{ field: 'id', errorCode: ErrorCode.NOT_FOUND, httpStatus: 404 }]
            }
        }

        // Handle INVALID_INPUT error (multiple status flags)
        if (errorMessage === 'INVALID_INPUT') {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: [{
                    field: 'status',
                    errorCode: ErrorCode.INVALID_INPUT,
                    httpStatus: 400
                }]
            }
        }

        // Generic error
        logger.error(`ERROR: Error updating submission ${submissionId}: ${error}`)
        return {
            data: {} as gqlTypes.Submission,
            hasErrors: true,
            errors: [{ field: 'updateSubmission', errorCode: ErrorCode.SERVER_ERROR, httpStatus: 500 }]
        }
    }
}

/**
 * Creates HP within an existing Kysely transaction (for approveSubmission). 
 * WHY THIS FUNCTION EXISTS:
 * - The original tryCreateHealthcareProfessionalForSubmission uses Supabase
 * - It cannot be called inside a Kysely transaction (different connection pools)
 * - This version does inline INSERT using the same transaction object
 * 
 * TRANSACTION-SAFE DESIGN:
 * - Uses transaction.insertInto() instead of Supabase client
 * - Shares the same transaction as approveSubmission
 * - If HP creation fails, entire approval is rolled back atomically
 * @param transaction - Kysely transaction object from parent function
 * @param current - Current submission row from DB
 * @param finalFacilityId - Facility ID to link the HP to
 * @param updatedBy - User performing the action (for audit)
 * @returns HP ID if created, undefined if skipped
 */
async function tryCreateHealthcareProfessionalForSubmissionInTransaction(
    transaction: Transaction<Database>,
    current: Selectable<SubmissionsTable>,
    finalFacilityId: string
    // updatedBy: string
): Promise<string | undefined> {
    if (current.hps_id) {
        return undefined
    }

    let hpInput: gqlTypes.CreateHealthcareProfessionalInput | null = null

    // Case A: healthcare_professionals_partial
    if (current.healthcare_professionals_partial && current.healthcare_professionals_partial.length > 0) {
        const firstHp = current.healthcare_professionals_partial[0]
        const hasNames = Array.isArray(firstHp.names) && firstHp.names.length > 0

        if (hasNames) {
            hpInput = {
                names: firstHp.names!,
                spokenLanguages: sanitizeLocales(
                    (firstHp.spokenLanguages ?? []) as (gqlTypes.Locale | null | undefined)[]
                ),
                degrees: firstHp.degrees ?? [],
                specialties: firstHp.specialties ?? [],
                acceptedInsurance: firstHp.acceptedInsurance ?? [],
                additionalInfoForPatients: firstHp.additionalInfoForPatients ?? '',
                facilityIds: [finalFacilityId]
            }
        } else if (current.healthcare_professional_name?.trim()) {
            const parsed = splitPersonName(current.healthcare_professional_name.trim())
            const localeFromSubmission = (current.spoken_languages?.[0] as gqlTypes.Locale) ?? gqlTypes.Locale.EnUs

            hpInput = {
                names: [{
                    locale: localeFromSubmission,
                    firstName: parsed.firstName,
                    lastName: parsed.lastName,
                    ...(parsed.middleName ? { middleName: parsed.middleName } : {})
                }],
                degrees: [],
                specialties: [],
                spokenLanguages: sanitizeLocales(current.spoken_languages as (gqlTypes.Locale | null | undefined)[]),
                acceptedInsurance: [],
                additionalInfoForPatients: current.notes ?? null,
                facilityIds: [finalFacilityId]
            }
        }
    } else if (current.healthcare_professional_name?.trim()) {
        // Case B: Only healthcareProfessionalName
        const parsed = splitPersonName(current.healthcare_professional_name.trim())
        const localeFromSubmission = (current.spoken_languages?.[0] as gqlTypes.Locale) ?? gqlTypes.Locale.EnUs

        hpInput = {
            names: [{
                locale: localeFromSubmission,
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                ...(parsed.middleName ? { middleName: parsed.middleName } : {})
            }],
            degrees: [],
            specialties: [],
            spokenLanguages: sanitizeLocales(current.spoken_languages as (gqlTypes.Locale | null | undefined)[]),
            acceptedInsurance: [],
            additionalInfoForPatients: current.notes ?? null,
            facilityIds: [finalFacilityId]
        }
    }

    if (!isValidHpInput(hpInput)) {
        return undefined
    }

    const licensed = licenseColumnsForDegrees(hpInput!.degrees)
    // Create HP inline in transaction (NO Supabase calls!)
    const insertedHp = await transaction
        .insertInto('hps')
        .values({
            names: asJsonb<gqlTypes.LocalizedName[]>(hpInput!.names),
            degrees: asJsonb<gqlTypes.Degree[]>(licensed.degrees),
            primary_license: licensed.primaryLicense,
            additional_credentials: asJsonb(licensed.additionalCredentials),
            license_review: licensed.licenseReview,
            license_recommendation: licensed.licenseRecommendation,
            specialties: asJsonb<gqlTypes.Specialty[]>(hpInput!.specialties ?? []),
            spoken_languages: asJsonb<gqlTypes.Locale[]>(hpInput!.spokenLanguages ?? []),
            accepted_insurance: asJsonb<gqlTypes.Insurance[]>(hpInput!.acceptedInsurance ?? []),
            email: null,
            created_date: new Date().toISOString(),
            updated_date: new Date().toISOString()
        })
        .returningAll()
        .executeTakeFirstOrThrow()

    // Create HP-Facility relation
    await transaction
        .insertInto('hps_facilities')
        .values({
             
            hps_id: insertedHp.id,
             
            facilities_id: finalFacilityId
        })
        .execute()

    return insertedHp.id
}

/**
 * Approves a pending submission and, if needed, creates:
 * - a Facility (from facility_partial or fallback data)
 * - a HealthcareProfessional (from partial data or name string)
 * Load current submission.
 * Short-circuit if already approved.
 * Ensure we have a Facility ID (create one if missing).
 * Ensure we optionally create an HP if enough data is present.
 * Update submission status to "approved" and link created entities.
 * Log an audit entry with old/new values.
 */
export const approveSubmission = async (
    submissionId: string,
    updatedBy: string
): Promise<Result<gqlTypes.Submission>> => {
    try {
        const preview = await db
            .selectFrom('submissions')
            .select(['facilities_id', 'google_maps_url', 'facility_partial'])
            .where('id', '=', submissionId)
            .executeTakeFirst()

        // Open a short link before the transaction so the row lock is not held during the request.
        const resolvedFrom = preview && !preview.facilities_id
            ? mapsUrlForApprovalFacility(preview).trim()
            : ''
        const resolvedMaps = preview && !preview.facilities_id
            ? await canonicalMapsFields(resolvedFrom)
            : null

        const gqlSubmission = await db.transaction().execute(async transaction => {
            // Fetch current submission
            const currentSubmission = await transaction
                .selectFrom('submissions')
                .selectAll()
                .where('id', '=', submissionId)
                .forUpdate()
                .executeTakeFirst()

            if (!currentSubmission) {
                throw new Error(`Submission not found: ${submissionId}`)
            }

            if (currentSubmission.status === SUBMISSION_STATUS.APPROVED) {
                throw new Error('SUBMISSION_ALREADY_APPROVED')
            }

            const approvalValidation = validateApprovalProfessionalFields({
                hpsId: currentSubmission.hps_id,
                facilityHealthcareProfessionalIds: currentSubmission.facility_partial?.healthcareProfessionalIds,
                healthcareProfessionals: currentSubmission.healthcare_professionals_partial
            })

            if (approvalValidation.hasErrors) {
                throw new SubmissionApprovalValidationError(approvalValidation.errors ?? [])
            }

            let finalFacilityId = currentSubmission.facilities_id

            // Create facility if needed
            if (!finalFacilityId) {
                let facilityInput: gqlTypes.CreateFacilityInput

                if (currentSubmission.facility_partial) {
                    facilityInput = currentSubmission.facility_partial as gqlTypes.CreateFacilityInput
                } else {
                    facilityInput = {
                        nameEn: 'Unknown Facility',
                        nameJa: 'Unknown Facility',
                        contact: createBlankContact(currentSubmission.google_maps_url ?? ''),
                        mapLatitude: 0,
                        mapLongitude: 0,
                        healthcareProfessionalIds: []
                    }
                }

                const currentUrl = (facilityInput.contact?.googleMapsUrl ?? '').trim()
                const useResolvedMaps = Boolean(resolvedMaps) && currentUrl === resolvedFrom
                if (useResolvedMaps && resolvedMaps) {
                    facilityInput = {
                        ...facilityInput,
                        contact: {
                            ...facilityInput.contact,
                            googleMapsUrl: resolvedMaps.url
                        }
                    }
                }

                // CRITICAL NESTED TRANSACTION
                // I'm tryin inline inside transaction
                const isOnline = facilityInput.online === true
                const storedContact = contactForStorage(
                    facilityInput.contact ?? createBlankContact(),
                    { clearLocation: isOnline }
                )
                const insertedFacility = await transaction
                    .insertInto('facilities')
                    .values({
                        name_en: facilityInput.nameEn,
                        name_ja: facilityInput.nameJa,
                        contact: asJsonb<gqlTypes.ContactInput>(storedContact),
                        map_latitude: isOnline ? null : (facilityInput.mapLatitude ?? null),
                        map_longitude: isOnline ? null : (facilityInput.mapLongitude ?? null),
                        created_date: new Date().toISOString(),
                        updated_date: new Date().toISOString(),
                        payment_options: JSON.stringify(facilityInput.paymentOptions ?? []),
                        city_id: null,
                        google_place_id: isOnline
                            ? null
                            : (useResolvedMaps && resolvedMaps ? resolvedMaps.placeId : null),
                        source: null,
                        verification_status: 'UNVERIFIED_LOCATION',
                        supported_languages: JSON.stringify(
                            uniqueLocales(facilityInput.supportedLanguages ?? []).filter(isPublishedLocale)
                        ),
                        online: isOnline
                    })
                    .returningAll()
                    .executeTakeFirstOrThrow()

                finalFacilityId = insertedFacility.id
            }

            // Create HP if needed
            let createdHpId: string | undefined

            if (finalFacilityId && !currentSubmission.hps_id) {
                createdHpId = await tryCreateHealthcareProfessionalForSubmissionInTransaction(
                    transaction,
                    currentSubmission,
                    finalFacilityId
                    // updatedBy
                )
            }

            // Update submission to be approved
            const updated = await transaction
                .updateTable('submissions')
                .set({
                    status: SUBMISSION_STATUS.APPROVED,
                    facilities_id: finalFacilityId,
                    hps_id: createdHpId ?? currentSubmission.hps_id,
                    updated_date: new Date().toISOString()
                })
                .where('id', '=', submissionId)
                .returningAll()
                .executeTakeFirstOrThrow()

            // Map to GraphQL
            const oldGqlSubmission = submissionFromRow(currentSubmission)
            const newGqlSubmission = submissionFromRow(updated)

            // Audit log
            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Update,
                objectType: gqlTypes.ObjectType.Submission,
                updatedBy,
                oldValue: oldGqlSubmission,
                newValue: newGqlSubmission
            })

            return newGqlSubmission
        })

        return { data: gqlSubmission, hasErrors: false }
    } catch (error) {
        if (error instanceof SubmissionApprovalValidationError) {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: error.validationErrors
            }
        }

        const errorMessage = (error as Error).message

        if (errorMessage === 'SUBMISSION_ALREADY_APPROVED') {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: [{ field: 'status', errorCode: ErrorCode.SUBMISSION_ALREADY_APPROVED, httpStatus: 400 }]
            }
        }

        if (errorMessage.includes('Submission not found')) {
            return {
                data: {} as gqlTypes.Submission,
                hasErrors: true,
                errors: [{ field: 'submissionId', errorCode: ErrorCode.NOT_FOUND, httpStatus: 404 }]
            }
        }

        logger.error(`Error approving submission ${submissionId}: ${error}`)
        return {
            data: {} as gqlTypes.Submission,
            hasErrors: true,
            errors: [{ field: 'status', errorCode: ErrorCode.SERVER_ERROR, httpStatus: 500 }]
        }
    }
}

/**
 * This deletes a Submission from the database. If the submission doesn't exist, it will return a validation error.
 * @param id The ID of the submission in the database to delete.
 */
export async function deleteSubmission(
    id: string,
    updatedBy: string
): Promise<Result<gqlTypes.DeleteResult>> {
    try {
        const validation = validateIdInput(id)

        if (validation.hasErrors) {
            logger.warn(`Validation Error: invalid id for deleteSubmission: ${id}`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: validation.errors
            }
        }

        await db.transaction().execute(async transaction => {
            // Step 1: Fetch existing submission
            const existing = await transaction
                .selectFrom('submissions')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()

            if (!existing) {
                throw new Error(`Submission not found: ${id}`)
            }

            // Step 2: Delete submission
            await transaction
                .deleteFrom('submissions')
                .where('id', '=', id)
                .execute()

            // Step 3: Audit log
            const oldGqlSubmission = submissionFromRow(existing)

            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Delete,
                objectType: gqlTypes.ObjectType.Submission,
                updatedBy,
                oldValue: oldGqlSubmission
            })
        })

        logger.info(`DB-DELETE: submission ${id} was deleted`)

        return {
            data: { isSuccessful: true },
            hasErrors: false
        }
    } catch (error) {
        const errorMessage = (error as Error).message

        if (errorMessage.includes('Submission not found')) {
            logger.warn(`deleteSubmission: submission not found: ${id}`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: [{
                    field: 'deleteSubmission',
                    errorCode: ErrorCode.INVALID_ID,
                    httpStatus: 404
                }]
            }
        }

        logger.error(`ERROR: Error deleting submission ${id}: ${error}`)
        return {
            data: { isSuccessful: false },
            hasErrors: true,
            errors: [{
                field: 'deleteSubmission',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}
