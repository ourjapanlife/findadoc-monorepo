import * as gqlTypes from '@findadoc/graphql'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'
import { logger } from '../logger.js'
import { createAuditLog } from './auditLogServiceSupabase.js'
import {
    hasUsableMapPin,
    validateIdInput,
    validateCreateFacilityInput,
    validateFacilitiesSearchInput,
    validateUpdateFacilityInput
} from '../validation/validateFacility.js'
import { facilityFromRow, facilityWithProfessionalIds } from '../services/mappersEntityService.js'
import { uniqueLocales } from '../languages/publishedLocales.js'
import { asJsonb } from '../../utils/dbUtils.js'
import { prefectureTranslations, resolvePrefectureKey } from '../../utils/japanesePrefectures.js'
import { likeContainsPattern, listQueryValue } from '../search/listQuery.js'
import { databaseOrderColumn, FACILITY_ORDER_COLUMNS } from '../search/orderColumn.js'
import { isCityRecordId, resolveFacilityPublication, verificationStatusForUpdate } from './facilityPublication.js'
import { cityExists, findCityBySlug } from './cityService.js'
import { FacilitySource } from '@findadoc/graphql'
import { matchingFacilityId } from '../places/facilityMapsMatch.js'
import { canonicalMapsFields, isShortMapsUrl, previewTargetFromMapsUrl, resolveMapsPlace } from '../places/mapsLink.js'
import { sql, type SelectQueryBuilder, type Transaction } from 'kysely'
import type { Database } from '../typeDefs/kyselyTypes.js'
import type { FacilityParent } from '../typeDefs/resolverParents.js'

function invalidCityId(): Result<FacilityParent> {
    return {
        data: {} as gqlTypes.Facility,
        hasErrors: true,
        errors: [{
            field: 'cityId',
            errorCode: ErrorCode.INVALID_INPUT,
            httpStatus: 400
        }]
    }
}

class FacilityUpdateRejected extends Error {
    constructor(readonly result: Result<FacilityParent>) {
        super('Facility update rejected')
    }
}

function blankAddress(): gqlTypes.PhysicalAddressInput {
    return {
        postalCode: '',
        prefectureEn: '',
        cityEn: '',
        addressLine1En: '',
        addressLine2En: '',
        prefectureJa: '',
        cityJa: '',
        addressLine1Ja: '',
        addressLine2Ja: ''
    }
}

/** Maps a stored Contact address into ContactInput shape. Null stays null. */
export function addressInputFromStored(
    address: gqlTypes.PhysicalAddress | gqlTypes.PhysicalAddressInput | null | undefined
): gqlTypes.PhysicalAddressInput | null | undefined {
    if (address === undefined) {
        return undefined
    }
    if (address === null) {
        return null
    }
    return {
        postalCode: address.postalCode ?? '',
        prefectureEn: address.prefectureEn ?? '',
        cityEn: address.cityEn ?? '',
        addressLine1En: address.addressLine1En ?? '',
        addressLine2En: address.addressLine2En ?? '',
        prefectureJa: address.prefectureJa ?? '',
        cityJa: address.cityJa ?? '',
        addressLine1Ja: address.addressLine1Ja ?? '',
        addressLine2Ja: address.addressLine2Ja ?? ''
    }
}

/**
 * Normal facilities store a full address. An online facility keeps phone and
 * stores address as null; Maps URL becomes empty.
 * An omitted address becomes a blank shape; an explicit null stays null.
 */
export function contactForStorage(
    contact: gqlTypes.ContactInput,
    options: { clearLocation: boolean }
): gqlTypes.ContactInput {
    if (options.clearLocation) {
        return {
            phone: contact.phone,
            email: contact.email ?? '',
            website: contact.website ?? '',
            googleMapsUrl: '',
            address: null
        }
    }
    return {
        phone: contact.phone,
        email: contact.email ?? '',
        website: contact.website ?? '',
        googleMapsUrl: contact.googleMapsUrl ?? '',
        address: contact.address === undefined ? blankAddress() : contact.address
    }
}

/**
 * Merges a contact update with the stored contact so omitted address and Maps URL
 * are not wiped on a phone-only (or similar) patch.
 */
export function contactUpdateForStorage(
    contact: gqlTypes.ContactInput,
    existingContact: gqlTypes.ContactInput | gqlTypes.Contact | undefined,
    options: { clearLocation: boolean }
): gqlTypes.ContactInput {
    const merged: gqlTypes.ContactInput = {
        ...contact,
        address: contact.address !== undefined
            ? contact.address
            : addressInputFromStored(existingContact?.address),
        googleMapsUrl: contact.googleMapsUrl !== undefined
            ? contact.googleMapsUrl
            : (existingContact?.googleMapsUrl ?? '')
    }
    return contactForStorage(merged, options)
}

/**
 * Normalizes facility contact before writing facility_partial so Contact.googleMapsUrl
 * (non-null in GraphQL) and address shape are always present when read back.
 */
export function facilityPartialForStorage(
    facility: gqlTypes.CreateFacilityInput | null | undefined
): gqlTypes.CreateFacilityInput | null {
    if (facility === undefined || facility === null) {
        return null
    }
    return {
        ...facility,
        contact: contactForStorage(facility.contact, {
            clearLocation: facility.online === true
        })
    }
}

/**
 * Builds a partial update patch for Facility rows.
 * When online becomes true, address, city, map, and place id are cleared.
 * Pass existingContact when contact is not in the update so phone is preserved.
 * An omitted address or Maps URL on a contact update keeps the stored value.
 */
export function buildFacilityUpdatePatch(
    fields: Partial<gqlTypes.UpdateFacilityInput>,
    existingContact?: gqlTypes.ContactInput | gqlTypes.Contact
) {
    const updatePatch: Record<string, unknown> = {}
    const becomingOnline = fields.online === true

    if (fields.nameEn !== undefined) {
        updatePatch.name_en = fields.nameEn
    }
    if (fields.nameJa !== undefined) {
        updatePatch.name_ja = fields.nameJa
    }
    if (fields.contact !== undefined && fields.contact !== null) {
        updatePatch.contact = contactUpdateForStorage(
            fields.contact,
            existingContact,
            { clearLocation: becomingOnline }
        )
    } else if (becomingOnline && existingContact) {
        updatePatch.contact = contactForStorage(
            {
                phone: existingContact.phone,
                email: existingContact.email ?? '',
                website: existingContact.website ?? '',
                googleMapsUrl: existingContact.googleMapsUrl ?? '',
                address: addressInputFromStored(existingContact.address) ?? blankAddress()
            },
            { clearLocation: true }
        )
    }
    if (becomingOnline) {
        updatePatch.map_latitude = null
        updatePatch.map_longitude = null
        updatePatch.city_id = null
        updatePatch.verification_status = 'UNVERIFIED_LOCATION'
        updatePatch.google_place_id = null
    } else {
        if (fields.mapLatitude !== undefined) {
            updatePatch.map_latitude = fields.mapLatitude
        }
        if (fields.mapLongitude !== undefined) {
            updatePatch.map_longitude = fields.mapLongitude
        }
        if (fields.cityId !== undefined) {
            updatePatch.city_id = fields.cityId
        }
        if (fields.verificationStatus !== undefined) {
            updatePatch.verification_status = fields.verificationStatus
        }
        if (fields.googlePlaceId !== undefined) {
            updatePatch.google_place_id = fields.googlePlaceId?.trim()
                ? fields.googlePlaceId.trim()
                : null
        }
    }
    if (fields.paymentOptions !== undefined) {
        updatePatch.payment_options = JSON.stringify(fields.paymentOptions)
    }
    if (fields.source !== undefined) {
        updatePatch.source = fields.source
    }
    if (fields.supportedLanguages !== undefined) {
        updatePatch.supported_languages = JSON.stringify(uniqueLocales(fields.supportedLanguages ?? []))
    }
    if (fields.online !== undefined) {
        updatePatch.online = fields.online === true
    }
    updatePatch.updated_date = new Date().toISOString()

    return updatePatch
}

/**
 * Applies the facility search filters to a facilities query.
 * Search and count use the same filters.
 *
 * @param query - The base facilities query.
 * @param filters - The facility search filters from GraphQL input.
 * @returns The query with the filters applied.
 */
export function applyFacilityFilters<O>(
  query: SelectQueryBuilder<Database, 'facilities', O>,
  filters: gqlTypes.FacilitySearchFilters
): SelectQueryBuilder<Database, 'facilities', O> {
    let filtered = query

    // Text filters (case-insensitive contains)
    if (filters.nameEn) {
        filtered = filtered.where('facilities.name_en', 'ilike', `%${filters.nameEn}%`)
    }
    if (filters.nameJa) {
        filtered = filtered.where('facilities.name_ja', 'ilike', `%${filters.nameJa}%`)
    }
    const queryText = listQueryValue(filters.query)
    if (queryText) {
        filtered = filtered.where('facilities.search_text', 'ilike', likeContainsPattern(queryText))
    }

    // Prefecture: match the canonical key on the English side (any casing) or the Japanese name.
    // Validation has already rejected unknown prefectures.
    const prefectureKey = filters.prefecture ? resolvePrefectureKey(filters.prefecture) : undefined

    if (prefectureKey) {
        filtered = filtered.where(eb => eb.or([
            eb(sql<string>`facilities.contact->'address'->>'prefectureEn'`, 'ilike', prefectureKey),
            eb(sql<string>`facilities.contact->'address'->>'prefectureJa'`, '=', prefectureTranslations[prefectureKey])
        ]))
    }

    // A specialty filter needs one linked professional with every requested specialty,
    // and that same professional must also speak every requested language. Language-only
    // search is an id subset instead, so a facility language can match when there is no professional.
    if (matchesThroughProfessional(filters)) {
        const specialties = filters.specialties ?? []
        const spokenLanguages = filters.spokenLanguages ?? []

        filtered = filtered.where(eb => eb.exists(
            eb.selectFrom('hps_facilities')
                .innerJoin('hps', 'hps.id', 'hps_facilities.hps_id')
                .select('hps.id')
                .whereRef('hps_facilities.facilities_id', '=', 'facilities.id')
                .where('hps.specialties', '@>', asJsonb(specialties))
                .$if(spokenLanguages.length > 0, professionals =>
                    professionals.where('hps.spoken_languages', '@>', asJsonb(spokenLanguages)))
        ))
    }

    return filtered
}

/** Specialty search stays on one professional. Language-only search does not. */
export function matchesThroughProfessional(filters: gqlTypes.FacilitySearchFilters): boolean {
    return !!filters.specialties?.length
}

/**
 * The facility that already stores this Google place id, or null when none does.
 * An invalid id is not a match.
 */
export async function getFacilityByGooglePlaceId(
    placeId: string
): Promise<Result<FacilityParent | null>> {
    if (!/^[A-Za-z0-9_-]{8,}$/.test(placeId)) {
        return { data: null, hasErrors: false }
    }

    try {
        const match = await db
            .selectFrom('facilities')
            .select('id')
            .where('google_place_id', '=', placeId)
            .orderBy('updated_date', 'desc')
            .limit(1)
            .executeTakeFirst()

        if (!match) {
            return { data: null, hasErrors: false }
        }

        const facility = await getFacilityById(match.id)
        if (facility.hasErrors) {
            return { data: null, hasErrors: true, errors: facility.errors }
        }

        return { data: facility.data, hasErrors: false }
    } catch (error) {
        logger.error(`ERROR: Error retrieving facility by place id: ${error}`)
        return {
            data: null,
            hasErrors: true,
            errors: [{
                field: 'facilityByGooglePlaceId',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * The clinic a Maps link already is.
 * A short iPhone link is opened once and read as a place id. When that id is not stored yet,
 * the clinic name inside the link, or a pin within 80 meters, is the same check.
 */
export async function getFacilityMatchingMapsUrl(
    url: string
): Promise<Result<FacilityParent | null>> {
    const trimmed = url.trim()
    if (!trimmed || trimmed.length > 2000) {
        return { data: null, hasErrors: false }
    }

    try {
        const target = isShortMapsUrl(trimmed)
            ? await resolveMapsPlace(trimmed)
            : previewTargetFromMapsUrl(trimmed)
        if (!target) {
            return { data: null, hasErrors: false }
        }

        if (target.placeId) {
            const byPlace = await getFacilityByGooglePlaceId(target.placeId)
            if (byPlace.hasErrors || byPlace.data) {
                return byPlace
            }
        }

        const rows = await db
            .selectFrom('facilities')
            .select(['id', 'name_en', 'name_ja', 'map_latitude', 'map_longitude'])
            .execute()
        const matchId = matchingFacilityId(target, rows.map(row => ({
            id: row.id,
            nameEn: row.name_en,
            nameJa: row.name_ja,
            latitude: row.map_latitude,
            longitude: row.map_longitude
        })))
        if (!matchId) {
            return { data: null, hasErrors: false }
        }

        const facility = await getFacilityById(matchId)
        if (facility.hasErrors) {
            return { data: null, hasErrors: true, errors: facility.errors }
        }
        return { data: facility.data, hasErrors: false }
    } catch (error) {
        logger.error(`ERROR: Error matching facility from maps url: ${error}`)
        return {
            data: null,
            hasErrors: true,
            errors: [{
                field: 'facilityMatchingMapsUrl',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

export async function contactWithCanonicalMapsUrl<T extends { googleMapsUrl?: string | null }>(
    contact: T
): Promise<{ contact: T & { googleMapsUrl: string }, placeId: string | null }> {
    const maps = await canonicalMapsFields(contact.googleMapsUrl ?? '')
    return {
        contact: { ...contact, googleMapsUrl: maps.url },
        placeId: maps.placeId
    }
}

/**
 * Gets the Facility from the database that matches on the id.
 * @param id The id of the Facility.
 * @returns A Facility object, without its professional ids.
 */
export const getFacilityById = async (
    id: string
): Promise<Result<FacilityParent>> => {
    try {
        // Validate the incoming id
        const validationResult = validateIdInput(id)

        if (validationResult.hasErrors) {
            logger.warn(`Validation Error: User passed in invalid facility id: ${id}`)
            return {
                data: {} as gqlTypes.Facility,
                hasErrors: true,
                errors: (validationResult.errors ?? []).map(err => ({
                    ...err,
                    field: 'getFacilityById'
                }))
            }
        }

        // Fetch the facility row
        const facilityRow = await db
            .selectFrom('facilities')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        // A missing facility is the caller's to handle, not a server failure (and not a Sentry event).
        if (!facilityRow) {
            return {
                data: {} as gqlTypes.Facility,
                hasErrors: true,
                errors: [{
                    field: 'getFacilityById',
                    errorCode: ErrorCode.NOT_FOUND,
                    httpStatus: 404
                }]
            }
        }

        return {
            data: facilityFromRow(facilityRow),
            hasErrors: false
        }
    } catch (error) {
        logger.error(`ERROR: Error retrieving facility by id: ${error}`)
        return {
            data: {} as gqlTypes.Facility,
            hasErrors: true,
            errors: [{
                field: 'getFacilityById',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Returns the set of Facility IDs that are linked to any of the given HP IDs.
 * Why a Set?
 * - A single facility can be linked to multiple HPs. Using a Set automatically
 * removes duplicates so the caller gets unique facility IDs.
 * @param hpIds Array of Healthcare Professional IDs to look up.
 * @returns A Set of facility IDs that have at least one relation with the provided HPs.
 * @throws Propagates the database error if the query fails.
 */
async function getFacilityIdsByHpIds(hpIds: string[]): Promise<Set<string>> {
    // Query the junction table to find all facility ids related to the given HP ids
    const rows = await db
        .selectFrom('hps_facilities')
        .select('facilities_id')
        .where('hps_id', 'in', hpIds)
        .execute()

    // Use a Set to ensure each facility id appears only once
    return new Set(rows.map(row => row.facilities_id))
}

/**
 * Loads the professional ids for each facility from the junction table in one query.
 * The per-request DataLoader in loaders.ts batches every facility in a response into one call.
 * @param facilityIds Facility ids to look up.
 * @returns A map from facility id to its professional ids. A facility with none is not in the map.
 */
export async function hpIdsByFacilityIds(facilityIds: string[]): Promise<Map<string, string[]>> {
    const hpIdsByFacility = new Map<string, string[]>()

    if (!facilityIds.length) {
        return hpIdsByFacility
    }

    const relations = await db
        .selectFrom('hps_facilities')
        .select(['hps_id', 'facilities_id'])
        .where('facilities_id', 'in', facilityIds)
        .execute()

    for (const relation of relations) {
        const list = hpIdsByFacility.get(relation.facilities_id) ?? []

        list.push(relation.hps_id)
        hpIdsByFacility.set(relation.facilities_id, list)
    }

    return hpIdsByFacility
}

/**
 * Facilities that advertise every requested language, either on the facility
 * or on one linked professional. One query, so a long match list is not truncated.
 * Does not create a professional.
 */
async function facilityIdsAdvertisingLanguages(languages: gqlTypes.Locale[]): Promise<Set<string>> {
    const requested = JSON.stringify(languages)
    const result = await sql<{ id: string }>`
        SELECT id FROM facilities
        WHERE supported_languages @> ${requested}::jsonb
        UNION
        SELECT hps_facilities.facilities_id AS id
        FROM hps_facilities
        JOIN hps ON hps.id = hps_facilities.hps_id
        WHERE hps.spoken_languages @> ${requested}::jsonb
          AND hps_facilities.facilities_id IS NOT NULL
    `.execute(db)

    return new Set(result.rows.map(row => row.id))
}

/**
 * null means the caller should not add an id filter.
 * An empty array means nothing matches.
 */
async function facilityIdSubsetForFilters(
    filters: gqlTypes.FacilitySearchFilters
): Promise<string[] | null> {
    let subset: Set<string> | null = null

    if (filters.healthcareProfessionalIds?.length) {
        subset = await getFacilityIdsByHpIds(filters.healthcareProfessionalIds as string[])

        if (!subset.size) {
            return []
        }
    }

    if (filters.spokenLanguages?.length && !matchesThroughProfessional(filters)) {
        const languageIds = await facilityIdsAdvertisingLanguages(filters.spokenLanguages)

        if (!languageIds.size) {
            return []
        }

        if (subset) {
            subset = new Set([...subset].filter(id => languageIds.has(id)))

            if (!subset.size) {
                return []
            }
        } else {
            subset = languageIds
        }
    }

    return subset ? Array.from(subset) : null
}

/**
 * Creates a new Facility. 
 * Any healthcareprofessionalIds will build an association, but it won't create a healthcare professional. 
 * You need to call the createHealthcareProfessional function separately. This prevents hidden side effects.
 * @param facilityInput 
 * @returns A Facility with a list containing the ID of the initial HealthcareProfessional that was created.
 */
export async function createFacility(
    facilityInput: gqlTypes.CreateFacilityInput,
    updatedBy: string
): Promise<Result<FacilityParent>> {
    try {
        // Validate input before attempting database operations
        const validationResult = validateCreateFacilityInput(facilityInput)

        if (validationResult.hasErrors) {
            return validationResult as Result<FacilityParent>
        }

        const isOnline = facilityInput.online === true
        let cityId: string | null = null
        let verificationStatus: string = 'UNVERIFIED_LOCATION'

        if (!isOnline) {
            const publication = resolveFacilityPublication({
                cityId: facilityInput.cityId,
                verificationStatus: facilityInput.verificationStatus
            })

            if (publication.hasErrors) {
                return {
                    data: {} as gqlTypes.Facility,
                    hasErrors: true,
                    errors: publication.errors
                }
            }

            if (publication.data.cityId && !isCityRecordId(publication.data.cityId)) {
                return invalidCityId()
            }

            if (publication.data.cityId && !(await cityExists(publication.data.cityId))) {
                return invalidCityId()
            }

            cityId = publication.data.cityId
            verificationStatus = publication.data.verificationStatus
        }

        // Extract HP IDs for convenience
        const hpIds = (facilityInput.healthcareProfessionalIds ?? []) as string[]
        const storedContact = contactForStorage(facilityInput.contact, { clearLocation: isOnline })
        const canonicalContact = isOnline
            ? { contact: storedContact, placeId: null as string | null }
            : await contactWithCanonicalMapsUrl(storedContact)
        const googlePlaceId = isOnline
            ? null
            : (facilityInput.googlePlaceId?.trim()
                ? facilityInput.googlePlaceId.trim()
                : canonicalContact.placeId)

        // Execute all database operations in a single atomic transaction.
        // The transaction returns the final plain GraphQL object (not the Kysely result).
        // If any operation fails, everything is automatically rolled back.
        const gqlFacility = await db.transaction().execute(async transaction => {
            // Step 1: Insert facility into PostgreSQL
            // PostgreSQL generates UUID automatically via DEFAULT gen_random_uuid()
            const insertedFacility = await transaction
                .insertInto('facilities')
                .values({
                    name_en: facilityInput.nameEn,
                    name_ja: facilityInput.nameJa,
                    contact: canonicalContact.contact,
                    map_latitude: isOnline ? null : (facilityInput.mapLatitude ?? null),
                    map_longitude: isOnline ? null : (facilityInput.mapLongitude ?? null),
                    payment_options: JSON.stringify(facilityInput.paymentOptions ?? []),
                    city_id: cityId,
                    google_place_id: googlePlaceId,
                    source: facilityInput.source ?? FacilitySource.Manual,
                    verification_status: verificationStatus,
                    supported_languages: JSON.stringify(uniqueLocales(facilityInput.supportedLanguages ?? [])),
                    online: isOnline,
                    created_date: new Date().toISOString(),
                    updated_date: new Date().toISOString()
                })
                .returningAll()
                .executeTakeFirstOrThrow() // Throws if insert fails

            // Step 2: Create associations with healthcare professionals (if any provided)
            if (hpIds.length) {
                // Build junction table rows for the many-to-many relationship
                const joinRows = hpIds.map(hpsId => ({
                    hps_id: hpsId,
                    facilities_id: insertedFacility.id
                }))

                // Insert relations into junction table
                // onConflict handles duplicate prevention (composite primary key protection)
                await transaction
                    .insertInto('hps_facilities')
                    .values(joinRows)
                    .onConflict(oc => oc
                        .columns(['hps_id', 'facilities_id'])
                        .doNothing()) // Ignore duplicates instead of failing
                    .execute()
            }

            // Step 3: Convert Kysely result to plain GraphQL object
            // IMPORTANT: This removes Kysely's internal private members (#props)
            // which would cause serialization errors in GraphQL responses
            const plainGqlFacility = facilityWithProfessionalIds(insertedFacility, hpIds)

            // Step 4: Record this creation in the audit log
            // Uses the same transaction (transaction) to ensure atomicity:
            // - If audit log fails, the facility creation is also rolled back
            // - If audit log succeeds, both operations are committed together
            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Create,
                objectType: gqlTypes.ObjectType.Facility,
                updatedBy,
                newValue: plainGqlFacility // Plain object is safe to serialize
            })

            // Return the plain GraphQL object from the transaction
            // CRITICAL: We return plainGqlFacility (plain object), NOT insertedFacility (Kysely object)
            // This ensures GraphQL receives a serializable object without private members
            return plainGqlFacility
        })

        // At this point:
        // - Transaction completed successfully (committed)
        // - gqlFacility is a plain JavaScript object (safe for GraphQL)
        // - All three operations (insert, relations, audit) succeeded atomically

        logger.info(`\nDB-CREATE: CREATE facility ${gqlFacility.id}.\nEntity: ${JSON.stringify(gqlFacility)}`)

        return {
            data: gqlFacility,
            hasErrors: false
        }
    } catch (error) {
        // If we reach here, the transaction was automatically rolled back
        // No manual cleanup needed - PostgreSQL guarantees consistency
        // The database state is exactly as it was before the transaction started
        logger.error(`ERROR: Error creating facility: ${error}`)

        return {
            data: {} as gqlTypes.Facility,
            hasErrors: true,
            errors: [{
                field: 'createFacility',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}
/**
 * Searches for a paginated list of Facilities based on various criteria.
 * This function handles multi-step filtering:
 * - It optionally applies a filter based on associated Healthcare Professional IDs (HP)
 * by performing a preliminary lookup to get a subset of Facility IDs.
 * - It applies scalar filters, ordering, and pagination to the main facilities table.
 * @param filters Optional search and pagination filters for Facilities.
 * @param maxLimit The most rows one page may return (defaults to 100).
 * @returns A Promise that resolves to a Result object containing an array of Facilities,
 * without their professional ids.
 */
export async function searchFacilities(
  filters: gqlTypes.FacilitySearchFilters = {},
  maxLimit = 100
): Promise<Result<FacilityParent[]>> {
    try {
        const validationResult = validateFacilitiesSearchInput(filters)

        if (validationResult.hasErrors) {
            return { data: [], hasErrors: true, errors: validationResult.errors }
        }

        const requestedLimit = filters.limit ?? 20
        const limit = requestedLimit > maxLimit ? maxLimit : requestedLimit

        const offset = filters.offset ?? 0

        const facilityIdSubset = await facilityIdSubsetForFilters(filters)

        if (facilityIdSubset && !facilityIdSubset.length) {
            return { data: [], hasErrors: false }
        }

        // Base query on facilities + scalar filters.
        let baseQuery = applyFacilityFilters(db.selectFrom('facilities').selectAll('facilities'), filters)

        // If there is a subset of IDs (from HPs or languages), filter with IN.
        if (facilityIdSubset) {
            baseQuery = baseQuery.where('facilities.id', 'in', facilityIdSubset)
        }

        // Determine the field and direction for ordering, falling back to nameEn if no order is specified
        const orderBy = filters.orderBy?.[0]
        const orderColumn = databaseOrderColumn(orderBy?.fieldToOrder, FACILITY_ORDER_COLUMNS)

        if (orderColumn !== null) {
            baseQuery = baseQuery.orderBy(
                sql.ref(`facilities.${orderColumn}`),
                orderBy?.orderDirection === 'desc' ? 'desc' : 'asc'
            )
        } else {
            baseQuery = baseQuery.orderBy('facilities.name_en', 'asc')
        }

        // Execute the main query, applying the offset and limit for the current page
        const paginationRows = await baseQuery.limit(limit).offset(offset).execute()

        return { data: paginationRows.map(row => facilityFromRow(row)), hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: searchFacilities ${JSON.stringify(filters)} -> ${err}`)
        return {
            data: [],
            hasErrors: true,
            errors: [{
                field: 'searchFacilities',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Counts the total number of Facilities matching the provided filters.
 * This function applies direct scalar filters to the professional data
 * and returns the exact count of the results.
 * add an extra filter if we wanna search only a type of hps
 * @param filters An optional object of search filters for Facilities
 * @returns A Promise that resolves to a Result object containing the count (number) or errors.
 */
export async function countFacilities(
  filters: gqlTypes.FacilitySearchFilters = {}
): Promise<Result<number>> {
    try {
        const validationResult = validateFacilitiesSearchInput(filters)

        if (validationResult.hasErrors) {
            return { data: 0, hasErrors: true, errors: validationResult.errors }
        }

        // Base query on facilities + scalar filters
        let baseQuery = applyFacilityFilters(
            db.selectFrom('facilities').select(eb => eb.fn.countAll<string>().as('count')),
            filters
        )

        const facilityIdSubset = await facilityIdSubsetForFilters(filters)

        if (facilityIdSubset && !facilityIdSubset.length) {
            return { data: 0, hasErrors: false }
        }

        if (facilityIdSubset) {
            baseQuery = baseQuery.where('facilities.id', 'in', facilityIdSubset)
        }

        // Postgres returns count(*) as a bigint string.
        const { count } = await baseQuery.executeTakeFirstOrThrow()

        return { data: Number(count), hasErrors: false }
    } catch (err) {
        logger.error(`ERROR: countFacilities ${JSON.stringify(filters)} -> ${err}`)
        return {
            data: 0,
            hasErrors: true,
            errors: [{
                field: 'countFacilities',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Updates a Facility in the database based on the id.
 * - Scalar fields are updated on facilities
 * - Relationship changes (HPs) are applied in hps_facilities via the provided actions
 * - Returns the updated Facility
*/
export const updateFacility = async (
    facilityId: string,
    fieldsToUpdate: Partial<gqlTypes.UpdateFacilityInput>,
    updatedBy: string
): Promise<Result<FacilityParent>> => {
    try {
        // Validate input before attempting database operations
        const validationResult = validateUpdateFacilityInput(fieldsToUpdate)

        if (validationResult.hasErrors) {
            return validationResult as Result<FacilityParent>
        }

        let fields = fieldsToUpdate
        let resolvedPlaceId: string | null = null
        // Only canonicalize when this update supplies a Maps URL. An omitted URL
        // keeps the stored one in buildFacilityUpdatePatch.
        if (
            fields.contact
            && fields.online !== true
            && (fields.contact.googleMapsUrl ?? '').trim()
        ) {
            const canonicalContact = await contactWithCanonicalMapsUrl(fields.contact)
            resolvedPlaceId = canonicalContact.placeId
            fields = {
                ...fields,
                contact: canonicalContact.contact
            }
        }

        // Execute all database operations in a single atomic transaction
        const result = await db.transaction().execute(async transaction => {
            // Lock the row first. The city decision has to use this state, not an earlier read.
            const originalFacility = await transaction
                .selectFrom('facilities')
                .selectAll()
                .where('id', '=', facilityId)
                .forUpdate()
                .executeTakeFirst()

            if (!originalFacility) {
                throw new Error(`Could not find facility with id ${facilityId} to update.`)
            }

            const becomingOnline = fields.online === true
            const goingOffline = fields.online === false && originalFacility.online === true
            if (goingOffline) {
                const existingContact = originalFacility.contact as gqlTypes.ContactInput | null
                const mergedAddress = fields.contact?.address !== undefined
                    ? fields.contact.address
                    : existingContact?.address
                const mergedMapsUrl = fields.contact?.googleMapsUrl !== undefined
                    ? fields.contact.googleMapsUrl
                    : (existingContact?.googleMapsUrl ?? '')
                const mergedLat = fields.mapLatitude !== undefined
                    ? fields.mapLatitude
                    : originalFacility.map_latitude
                const mergedLng = fields.mapLongitude !== undefined
                    ? fields.mapLongitude
                    : originalFacility.map_longitude
                const offlineLocationErrors: NonNullable<Result<FacilityParent>['errors']> = []
                if (!mergedAddress) {
                    offlineLocationErrors.push({
                        field: 'contact.address',
                        errorCode: ErrorCode.REQUIRED,
                        httpStatus: 400
                    })
                }
                if (!(mergedMapsUrl ?? '').trim()) {
                    offlineLocationErrors.push({
                        field: 'contact.googleMapsUrl',
                        errorCode: ErrorCode.REQUIRED,
                        httpStatus: 400
                    })
                }
                if (!hasUsableMapPin(
                    mergedLat === null ? null : Number(mergedLat),
                    mergedLng === null ? null : Number(mergedLng)
                )) {
                    offlineLocationErrors.push({
                        field: 'mapLatitude',
                        errorCode: ErrorCode.REQUIRED,
                        httpStatus: 400
                    })
                    offlineLocationErrors.push({
                        field: 'mapLongitude',
                        errorCode: ErrorCode.REQUIRED,
                        httpStatus: 400
                    })
                }
                if (offlineLocationErrors.length > 0) {
                    throw new FacilityUpdateRejected({
                        data: {} as gqlTypes.Facility,
                        hasErrors: true,
                        errors: offlineLocationErrors
                    })
                }
            }

            let publicationPatch: { city_id: string | null, verification_status: string } | undefined

            if (
                !becomingOnline
                && (fieldsToUpdate.cityId !== undefined || fieldsToUpdate.verificationStatus !== undefined)
            ) {
                const requestedStatus = verificationStatusForUpdate(
                    originalFacility.city_id,
                    originalFacility.verification_status as gqlTypes.FacilityVerificationStatus,
                    fieldsToUpdate.cityId,
                    fieldsToUpdate.verificationStatus
                )
                const publication = resolveFacilityPublication({
                    cityId: fieldsToUpdate.cityId !== undefined
                        ? fieldsToUpdate.cityId
                        : originalFacility.city_id,
                    verificationStatus: requestedStatus
                })

                if (publication.hasErrors) {
                    throw new FacilityUpdateRejected({
                        data: {} as gqlTypes.Facility,
                        hasErrors: true,
                        errors: publication.errors
                    })
                }

                const nextCityId = publication.data.cityId

                if (nextCityId && (!isCityRecordId(nextCityId) || !(await cityExists(nextCityId)))) {
                    throw new FacilityUpdateRejected(invalidCityId())
                }

                publicationPatch = {
                    city_id: publication.data.cityId,
                    verification_status: publication.data.verificationStatus
                }
            }

            // Fetch original HP relations
            const originalRelations = await transaction
                .selectFrom('hps_facilities')
                .select('hps_id')
                .where('facilities_id', '=', facilityId)
                .execute()

            const originalHpIds = originalRelations.map(r => r.hps_id)

            // Update scalar fields on facilities table (if any provided)
            const updatePayload: Record<string, unknown> = {
                ...buildFacilityUpdatePatch(
                    fields,
                    originalFacility.contact as gqlTypes.ContactInput
                ),
                ...publicationPatch
            }
            if (
                !becomingOnline
                && resolvedPlaceId
                && !originalFacility.google_place_id
                && fields.googlePlaceId === undefined
            ) {
                updatePayload.google_place_id = resolvedPlaceId
            }
            
            let updatedFacility = originalFacility

            if (Object.keys(updatePayload).length > 1) {
                // Has fields to update beyond just updatedDate
                updatedFacility = await transaction
                    .updateTable('facilities')
                    .set(updatePayload)
                    .where('id', '=', facilityId)
                    .returningAll()
                    .executeTakeFirstOrThrow()

                logger.info(`DB-UPDATE: facilities ${facilityId} scalar fields updated.`)
            } else {
                // No scalar fields to update, but touch updatedDate to track the change
                updatedFacility = await transaction
                    .updateTable('facilities')
                    .set({ updated_date: new Date().toISOString() })
                    .where('id', '=', facilityId)
                    .returningAll()
                    .executeTakeFirstOrThrow()
            }

            // Update relationships (if any provided)
            let finalHpIds = originalHpIds

            if (fieldsToUpdate.healthcareProfessionalIds && fieldsToUpdate.healthcareProfessionalIds.length) {
                finalHpIds = await processHealthcareProfessionalRelationshipChanges(
                    transaction,
                    facilityId,
                    fieldsToUpdate.healthcareProfessionalIds
                )
            }

            // Create audit log entry
            // If this fails, the entire transaction (including updates) is rolled back
            const oldGqlFacility = facilityWithProfessionalIds(originalFacility, originalHpIds)
            const newGqlFacility = facilityWithProfessionalIds(updatedFacility, finalHpIds)

            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Update,
                objectType: gqlTypes.ObjectType.Facility,
                updatedBy,
                oldValue: oldGqlFacility,
                newValue: newGqlFacility
            })

            // Return the updated facility and final HP IDs for mapping
            return { facility: updatedFacility, hpIds: finalHpIds }
        })

        // Map database result to GraphQL type
        const gqlFacility = facilityWithProfessionalIds(result.facility, result.hpIds)

        return { data: gqlFacility, hasErrors: false }
    } catch (error) {
        if (error instanceof FacilityUpdateRejected) {
            return error.result
        }

        // If we reach here, the transaction was automatically rolled back
        // The facility remains in its original state
        const errorMessage = (error as Error).message
        
        if (errorMessage.includes('Could not find facility')) {
            logger.warn(`updateFacility: facility not found: ${facilityId}`)
            return {
                data: {} as gqlTypes.Facility,
                hasErrors: true,
                errors: [{
                    field: 'updateFacility',
                    errorCode: ErrorCode.INVALID_ID,
                    httpStatus: 404
                }]
            }
        }

        logger.error(`ERROR: Error updating facility ${facilityId}: ${error}`)
        return {
            data: {} as gqlTypes.Facility,
            hasErrors: true,
            errors: [{
                field: 'updateFacility',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Apply relationship changes (Create/Delete) between ONE facility and MANY HPs.
 * In SQL this means insert/delete rows in the join table hps_facilities.
 * @returns the final list of HP ids for that facility
 */
async function processHealthcareProfessionalRelationshipChanges(
    transaction: Transaction<Database>,
    facilityId: string,
    changes: gqlTypes.Relationship[]
): Promise<string[]> {
    if (!changes || !changes.length) {
        // No changes, return current state
        const currentRelations = await transaction
            .selectFrom('hps_facilities')
            .select('hps_id')
            .where('facilities_id', '=', facilityId)
            .execute()
        
        //eslint-disable-next-line
        return currentRelations.map((r: any) => r.hps_id)
    }

    // Split creates and deletes
    const toCreate = changes
        .filter(c => c.action === gqlTypes.RelationshipAction.Create)
        .map(c => ({
            hps_id: c.otherEntityId,
            facilities_id: facilityId
        }))

    const toDelete = changes
        .filter(c => c.action === gqlTypes.RelationshipAction.Delete)
        .map(c => c.otherEntityId)

    // Process inserts (if any)
    if (toCreate.length) {
        await transaction
            .insertInto('hps_facilities')
            .values(toCreate)
            //eslint-disable-next-line
            .onConflict((oc: any) => oc
                .columns(['hps_id', 'facilities_id'])
                .doNothing())
            .execute()
    }

    // Process deletes (if any)
    if (toDelete.length) {
        await transaction
            .deleteFrom('hps_facilities')
            .where('facilities_id', '=', facilityId)
            .where('hps_id', 'in', toDelete)
            .execute()
    }

    // Return the final list of HPs for this facility
    const finalRelations = await transaction
        .selectFrom('hps_facilities')
        .select('hps_id')
        .where('facilities_id', '=', facilityId)
        .execute()

    //eslint-disable-next-line
    return finalRelations.map((r: any) => r.hps_id)
}

/** Thrown inside the delete transaction so it rolls back. */
class FacilityHasBookingsError extends Error {
    constructor(readonly bookingCount: number) {
        super(`Facility has ${bookingCount} bookings`)
    }
}

/**
 * Patient records that keep a facility from being deleted: every booking request,
 * and any upload or appointment not attached to one. The booking tables reference
 * facilities with ON DELETE RESTRICT so these are never deleted with a clinic.
 */
async function countFacilityBookings(transaction: Transaction<Database>, facilityId: string): Promise<number> {
    const { rows: [row] } = await sql<{ count: number }>`
        SELECT
            (SELECT count(*) FROM booking_submissions WHERE facility_id = ${facilityId})
          + (SELECT count(*) FROM booking_uploads WHERE facility_id = ${facilityId} AND booking_submission_id IS NULL)
          + (SELECT count(*) FROM booking_appointments WHERE facility_id = ${facilityId} AND booking_submission_id IS NULL)
          AS count
    `.execute(transaction)

    return Number(row?.count ?? 0)
}

/**
 * This deletes a Facility from the database.
 * If the Facility doesn't exist, it will return a validation error.
 * A facility with bookings is refused with FACILITY_HAS_BOOKINGS and the number of bookings.
 * Without bookings, its booking settings and extra open times are deleted with it.
 * @param id The ID of the facility in the database to delete.
 */
export async function deleteFacility(
    id: string,
    updatedBy: string
): Promise<Result<gqlTypes.DeleteResult>> {
    try {
        // Validate the facility ID format
        const validationResult = validateIdInput(id)

        if (validationResult.hasErrors) {
            logger.warn(`Validation Error: invalid id for deleteFacility: ${id}`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: validationResult.errors
            }
        }

        // Execute deletion and audit log in a single atomic transaction
        await db.transaction().execute(async transaction => {
            // Fetch the existing facility to verify it exists and for audit log
            const existingFacility = await transaction
                .selectFrom('facilities')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()

            // If facility doesn't exist, throw error to rollback transaction
            if (!existingFacility) {
                throw new Error(`Facility not found: ${id}`)
            }

            // Fetch related HP IDs for the audit log
            // (Relations will be deleted automatically by ON DELETE CASCADE)
            const relations = await transaction
                .selectFrom('hps_facilities')
                .select('hps_id')
                .where('facilities_id', '=', id)
                .execute()

            const hpIds = relations.map(r => r.hps_id)

            const bookingCount = await countFacilityBookings(transaction, id)

            if (bookingCount > 0) {
                throw new FacilityHasBookingsError(bookingCount)
            }

            // Clinic setup with no patient data. Weekly hours, closures, and members cascade.
            await transaction.deleteFrom('booking_settings').where('facility_id', '=', id).execute()
            await transaction.deleteFrom('clinic_availability_windows').where('facility_id', '=', id).execute()

            // Delete the facility
            // ON DELETE CASCADE will automatically delete rows in hps_facilities
            await transaction
                .deleteFrom('facilities')
                .where('id', '=', id)
                .execute()

            //Create audit log entry
            // If this fails, the entire transaction (including the delete) is rolled back
            const oldGqlFacility = facilityWithProfessionalIds(existingFacility, hpIds)

            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Delete,
                objectType: gqlTypes.ObjectType.Facility,
                updatedBy,
                oldValue: oldGqlFacility
            })
        })

        logger.info(`\nDB-DELETE: facility ${id} was deleted.`)

        return {
            data: { isSuccessful: true },
            hasErrors: false
        }
    } catch (error) {
        // If we reach here, the transaction was automatically rolled back
        // The facility still exists in the database no manual cleanup needed

        if (error instanceof FacilityHasBookingsError) {
            logger.warn(`deleteFacility: facility ${id} has ${error.bookingCount} bookings`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: [{
                    field: 'deleteFacility',
                    errorCode: ErrorCode.FACILITY_HAS_BOOKINGS,
                    httpStatus: 409,
                    count: error.bookingCount
                }]
            }
        }

        // Check if it's a "not found" error vs other database errors
        const errorMessage = (error as Error).message

        if (errorMessage.includes('Facility not found')) {
            logger.warn(`deleteFacility: facility not found: ${id}`)
            return {
                data: { isSuccessful: false },
                hasErrors: true,
                errors: [{
                    field: 'deleteFacility',
                    errorCode: ErrorCode.INVALID_ID,
                    httpStatus: 404
                }]
            }
        }

        logger.error(`ERROR: Error deleting facility ${id}: ${error}`)

        return {
            data: { isSuccessful: false },
            hasErrors: true,
            errors: [{
                field: 'deleteFacility',
                errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}

/**
 * Facilities published under one city. Rows with no city stay out of this list.
 */
export async function listPublishedCityFacilities(
    prefecture: string,
    citySlug: string
): Promise<Result<FacilityParent[]>> {
    try {
        const cityResult = await findCityBySlug(prefecture, citySlug)

        if (cityResult.hasErrors) {
            return { data: [], hasErrors: true, errors: cityResult.errors }
        }

        if (!cityResult.data) {
            return { data: [], hasErrors: false }
        }

        const rows = await db
            .selectFrom('facilities')
            .selectAll()
            .where('city_id', '=', cityResult.data.id)
            .where('verification_status', '<>', gqlTypes.FacilityVerificationStatus.UnverifiedLocation)
            .execute()

        return { data: rows.map(row => facilityFromRow(row)), hasErrors: false }
    } catch (error) {
        logger.error(`ERROR: listPublishedCityFacilities ${error}`)
        return {
            data: [],
            hasErrors: true,
            errors: [{
                field: 'cityFacilities',
                errorCode: ErrorCode.SERVER_ERROR,
                httpStatus: 500
            }]
        }
    }
}
