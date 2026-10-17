import type { GraphQLResolveInfo, SelectionSetNode } from 'graphql'
import type * as gqlTypes from '@findadoc/graphql'
import type { FacilitiesTable, HpsTable, SubmissionsTable } from '../src/typeDefs/kyselyTypes.js'

/** Schema fields, without the codegen `__typename` marker. */
type SchemaField<T> = Exclude<keyof T, '__typename'>
type ColumnName<Table> = Extract<keyof Table, string>
type FieldColumn<T, Table> = Record<SchemaField<T>, ColumnName<Table> | 'skip'>

/**
 * Parses GraphQLResolveInfo to extract the set of top-level fields
 * requested by the client. Handles FragmentSpread and InlineFragment.
 */
export function getRequestedFields(info: GraphQLResolveInfo): Set<string> {
    const fields = new Set<string>()

    for (const fieldNode of info.fieldNodes) {
        if (fieldNode.selectionSet) {
            collectFields(fieldNode.selectionSet, info, fields)
        }
    }

    return fields
}

function collectFields(
    selectionSet: SelectionSetNode,
    info: GraphQLResolveInfo,
    fields: Set<string>
): void {
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
        case 'Field':
            fields.add(selection.name.value)
            break
        case 'FragmentSpread': {
            const fragment = info.fragments[selection.name.value]

            if (fragment) {
                collectFields(fragment.selectionSet, info, fields)
            }
            break
        }
        case 'InlineFragment':
            collectFields(selection.selectionSet, info, fields)
            break
        }
    }
}

/** Returns true if the client requested healthcareProfessionalIds on a Facility */
export function facilityNeedsHpIds(requestedFields: Set<string>): boolean {
    return requestedFields.has('healthcareProfessionalIds')
}

/** Returns true if the client requested facilityIds on a HealthcareProfessional */
export function hpNeedsFacilityIds(requestedFields: Set<string>): boolean {
    return requestedFields.has('facilityIds')
}

/** Converts a camelCase string to snake_case */
export function camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

// --- GQL → DB column mappings ---
// Each moderation list type maps every schema field to a table column.
// `skip` means the API fills that field from another table.

/**
 * Every Facility field names a real facilities column, or `skip` when the API resolves it elsewhere.
 * A new schema field or a renamed column fails typecheck until this map is updated.
 * `city` selects `city_id` because the city resolver reads that id.
 */
const FACILITY_FIELD_COLUMN = {
    id: 'id',
    nameEn: 'name_en',
    nameJa: 'name_ja',
    contact: 'contact',
    mapLatitude: 'map_latitude',
    mapLongitude: 'map_longitude',
    healthcareProfessionalIds: 'skip',
    supportedLanguages: 'supported_languages',
    createdDate: 'created_date',
    updatedDate: 'updated_date',
    paymentOptions: 'payment_options',
    cityId: 'city_id',
    city: 'city_id',
    googlePlaceId: 'google_place_id',
    source: 'source',
    verificationStatus: 'verification_status'
} as const satisfies FieldColumn<gqlTypes.Facility, FacilitiesTable>

/**
 * Every HealthcareProfessional field names a real hps column, or `skip` for the junction.
 */
const HP_FIELD_COLUMN = {
    id: 'id',
    names: 'names',
    spokenLanguages: 'spoken_languages',
    degrees: 'degrees',
    primaryLicense: 'primary_license',
    additionalCredentials: 'additional_credentials',
    licenseReview: 'license_review',
    licenseRecommendation: 'license_recommendation',
    specialties: 'specialties',
    acceptedInsurance: 'accepted_insurance',
    facilityIds: 'skip',
    createdDate: 'created_date',
    updatedDate: 'updated_date',
    additionalInfoForPatients: 'additional_info_for_patients'
} as const satisfies FieldColumn<gqlTypes.HealthcareProfessional, HpsTable>

/**
 * Every Submission field names a real submissions column.
 * Status flags share `status`. Partials use the stored JSON columns.
 */
const SUBMISSION_FIELD_COLUMN = {
    id: 'id',
    googleMapsUrl: 'google_maps_url',
    healthcareProfessionalName: 'healthcare_professional_name',
    spokenLanguages: 'spoken_languages',
    facility: 'facility_partial',
    healthcareProfessionals: 'healthcare_professionals_partial',
    isUnderReview: 'status',
    isApproved: 'status',
    isRejected: 'status',
    createdDate: 'created_date',
    updatedDate: 'updated_date',
    notes: 'notes'
} as const satisfies FieldColumn<gqlTypes.Submission, SubmissionsTable>

/** JSONB columns on hps that may be used in PostgREST .contains() filters.
 *  Always included in select to avoid PostgREST errors when filtering on non-selected columns. */
const HP_FILTER_COLUMNS = [
    'degrees', 'specialties', 'spoken_languages', 'accepted_insurance'
] as const satisfies readonly ColumnName<HpsTable>[]

/** Text search columns. Renaming one fails typecheck at the filter call. */
export const FACILITY_SEARCH_COLUMN = 'search_text' satisfies ColumnName<FacilitiesTable>
export const HP_SEARCH_COLUMN = 'search_text' satisfies ColumnName<HpsTable>

// --- Select string builders ---

/**
 * Builds a select string from requested GQL fields.
 * By default, converts each field via camelToSnake.
 * Fields in `skip` are ignored. Fields in `overrides` use the mapped DB column instead.
 */
function buildSelectString(
    requestedFields: Set<string>,
    options: {
        skip?: Set<string>,
        overrides?: Record<string, string>,
        alwaysInclude?: readonly string[]
    } = {}
): string {
    const { skip = new Set(), overrides = {}, alwaysInclude = ['id'] } = options
    const columns = new Set<string>(alwaysInclude)

    for (const gqlField of requestedFields) {
        if (skip.has(gqlField)) continue

        if (gqlField in overrides) {
            columns.add(overrides[gqlField])
        } else {
            columns.add(camelToSnake(gqlField))
        }
    }

    return Array.from(columns).join(',')
}

/** Selects only mapped columns. An unknown field is ignored so it cannot invent a missing column. */
function columnsFor(
    requestedFields: Set<string>,
    mapping: Record<string, string>,
    alwaysInclude: readonly string[]
): string {
    const columns = new Set<string>(alwaysInclude)

    for (const field of requestedFields) {
        const column = mapping[field]

        if (!column || column === 'skip') {
            continue
        }

        columns.add(column)
    }

    return Array.from(columns).join(',')
}

/**
 * Builds a Supabase select string for the facilities table.
 * Always includes 'id'. Only includes columns the client actually requested.
 */
export function buildFacilitySelectString(requestedFields: Set<string>): string {
    return columnsFor(requestedFields, FACILITY_FIELD_COLUMN, ['id'])
}

/**
 * Builds a Supabase select string for the hps table.
 * Always includes 'id' and all filter-used JSONB columns to avoid PostgREST errors.
 */
export function buildHpSelectString(requestedFields: Set<string>): string {
    return columnsFor(requestedFields, HP_FIELD_COLUMN, ['id', ...HP_FILTER_COLUMNS])
}

/**
 * Builds a Supabase select string for the submissions table.
 * Always includes 'id'. Non-standard mappings (status flags, partials) use explicit overrides.
 */
export function buildSubmissionSelectString(requestedFields: Set<string>): string {
    return columnsFor(requestedFields, SUBMISSION_FIELD_COLUMN, ['id'])
}

/**
 * Builds a Supabase select string for the user table.
 * Always includes 'id'.
 */
export function buildUserSelectString(requestedFields: Set<string>): string {
    return buildSelectString(requestedFields)
}
