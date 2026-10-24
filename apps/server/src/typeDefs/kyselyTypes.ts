import type { ColumnType, Generated } from 'kysely'
import * as gqlTypes from '@findadoc/graphql'
import type { Database as SupabaseDatabase } from './supabase-generated.js'

/**
 * Kysely Database types with proper JSONB typing
 * 
 * We override the auto-generated types to use our GraphQL types
 * for JSONB columns instead of generic 'Json' or 'unknown'.
 * 
 * This gives us:
 * - Full type safety (no 'as any' needed)
 * - Autocomplete in IDE
 * - Compile-time checks
 */

/**
 * Facilities Table
 * 
 * ColumnType<SelectType, InsertType, UpdateType>:
 * - SelectType: Type when reading from DB (SELECT)
 * - InsertType: Type when inserting (INSERT)
 * - UpdateType: Type when updating (UPDATE)
 */
export interface FacilitiesTable {
    id: Generated<string>
    code: string | null
    name_en: string
    name_ja: string
    contact: ColumnType<gqlTypes.Contact, gqlTypes.ContactInput, gqlTypes.ContactInput>
    map_latitude: number
    map_longitude: number
    created_date: string
    updated_date: string
    firestore_id: string | null
    payment_options: ColumnType<
        gqlTypes.PaymentOption[] | null,
        string,
        string
    >
    city_id: string | null
    google_place_id: string | null
    source: string | null
    verification_status: string
    supported_languages: ColumnType<gqlTypes.Locale[], string, string>
    search_text: Generated<string>
}

export interface PrefecturesTable {
    id: Generated<string>
    name_en: string
    name_ja: string
    slug: string
}

export interface CitiesTable {
    id: Generated<string>
    prefecture_id: string
    slug: string
    name_en: string
    name_ja: string
    lg_code: string
    google_place_id: string | null
    google_place_id_checked_at: string | null
}

/**
 * Named society or collaboration. A new affiliation is a row, not an enum value.
 */
export interface AffiliationsTable {
    id: Generated<string>
    name_en: string
    name_ja: string | null
    website: string | null
    logo_url: string | null
}

/**
 * One membership attaches an affiliation to exactly one facility or one healthcare professional.
 */
export interface AffiliationMembershipsTable {
    id: Generated<string>
    affiliation_id: string
    facilities_id: string | null
    hps_id: string | null
}

/**
 * HPs (Healthcare Professionals) Table
 */
export interface HpsTable {
    id: Generated<string>
    names: ColumnType<gqlTypes.LocalizedName[], gqlTypes.LocalizedName[], gqlTypes.LocalizedName[]>
    additional_info_for_patients: string | null
    degrees: ColumnType<gqlTypes.Degree[], gqlTypes.Degree[], gqlTypes.Degree[]>
    primary_license: string | null
    additional_credentials: ColumnType<gqlTypes.Degree[], gqlTypes.Degree[], gqlTypes.Degree[]>
    license_review: string | null
    license_recommendation: string | null
    specialties: ColumnType<gqlTypes.Specialty[], gqlTypes.Specialty[], gqlTypes.Specialty[]>
    spoken_languages: ColumnType<gqlTypes.Locale[], gqlTypes.Locale[], gqlTypes.Locale[]>
    accepted_insurance: ColumnType<gqlTypes.Insurance[], gqlTypes.Insurance[], gqlTypes.Insurance[]>
    email: string | null
    created_date: string
    updated_date: string
    firestore_id: string | null
    search_text: Generated<string>
}

/**
 * HPs-Facilities Junction Table (many-to-many)
 */
export interface HpsFacilitiesTable {
    hps_id: string
    facilities_id: string
}

/**
 * Submissions Table
 */
export interface SubmissionsTable {
    id: Generated<string>
    status: SubmissionStatusEnum
    created_date: string
    updated_date: string
    hps_id: string | null
    facilities_id: string | null
    google_maps_url: string | null
    healthcare_professional_name: string | null
    spoken_languages: ColumnType<gqlTypes.Locale[] | null, gqlTypes.Locale[] | null, gqlTypes.Locale[] | null>
    notes: string | null
    facility_partial: ColumnType<gqlTypes.FacilitySubmission | null, gqlTypes.FacilitySubmission 
        | null, gqlTypes.FacilitySubmission | null>
    healthcare_professionals_partial: ColumnType<gqlTypes.HealthcareProfessionalSubmission[]
        | null, gqlTypes.HealthcareProfessionalSubmission[] | null, gqlTypes.HealthcareProfessionalSubmission[] | null>
    firestore_id: string | null
}

/**
 * A login account. auth_subject is the Auth0 subject, empty until that person signs in.
 */
export interface UsersTable {
    id: Generated<string>
    display_name: string | null
    profile_pic_url: string | null
    auth_subject: string | null
    created_date: Generated<string>
    updated_date: string | null
}

/** The hospital's plan. Basic is three active seats. */
export interface FacilitySubscriptionsTable {
    facility_id: string
    plan: string
    seat_limit: number
    created_date: Generated<string>
    updated_date: string
}

/** One person at one hospital. Revoked rows stay and do not count as seats. */
export interface FacilityMembershipsTable {
    id: Generated<string>
    facility_id: string
    user_id: string
    hp_id: string | null
    role: string
    status: string
    created_date: Generated<string>
    updated_date: string
    revoked_date: string | null
}

/**
 * Audit Logs Table
 */
export interface AuditLogsTable {
    id: Generated<string>
    action_type: ActionTypeEnum
    object_type: ObjectTypeEnum
    schema_version: SchemaVersionEnum
    new_value: string | null
    old_value: string | null
    updated_by: string
    updated_date: Generated<string>
}

/**
 * A clinic-owned page. id is what an account and a future CRM attach to.
 * facility_id stays null until the directory listing exists.
 */
export interface ClinicSitesTable {
    id: Generated<string>
    facility_id: string | null
    slug: string
    status: string
    share_image_path: string
    hero_path: string
    theme: ColumnType<Record<string, unknown>, string, string>
    created_date: Generated<string>
    updated_date: Generated<string>
}

/** An account on a hosted clinic. owner manages it. staff is the future CRM seat. */
export interface ClinicMembershipsTable {
    id: Generated<string>
    clinic_site_id: string
    user_id: string
    role: string
    created_date: Generated<string>
}

export interface ClinicSiteLanguagesTable {
    clinic_site_id: string
    sort_order: number
    code: string
    native_name: string
    bcp47: string
}

/** A doctor on the hosted page. hp_id is the directory professional once one exists. */
export interface ClinicSiteDoctorsTable {
    id: Generated<string>
    clinic_site_id: string
    sort_order: number
    name_ja: string
    name_en: string
    image_path: string
    object_position: string
    hp_id: string | null
}

export interface ClinicSiteLocalesTable {
    clinic_site_id: string
    locale: string
    name: string
    description: string
    document: ColumnType<Record<string, unknown>, string, string>
}

/**
 * Database interface - combines all tables
 */
export interface Database {
    facilities: FacilitiesTable
    prefectures: PrefecturesTable
    cities: CitiesTable
    affiliations: AffiliationsTable
    affiliation_memberships: AffiliationMembershipsTable
    hps: HpsTable
    hps_facilities: HpsFacilitiesTable
    submissions: SubmissionsTable
    audit_logs: AuditLogsTable
    user: UsersTable
    facility_subscriptions: FacilitySubscriptionsTable
    facility_memberships: FacilityMembershipsTable
    clinic_sites: ClinicSitesTable
    clinic_memberships: ClinicMembershipsTable
    clinic_site_languages: ClinicSiteLanguagesTable
    clinic_site_doctors: ClinicSiteDoctorsTable
    clinic_site_locales: ClinicSiteLocalesTable
}

/**
 * Enums from the database
 */
export type ActionTypeEnum = SupabaseDatabase['public']['Enums']['action_type_enum']
export type ObjectTypeEnum = SupabaseDatabase['public']['Enums']['object_type_enum']
export type SchemaVersionEnum = SupabaseDatabase['public']['Enums']['schema_version_enum']
export type SubmissionStatusEnum = SupabaseDatabase['public']['Enums']['submission_status_enum']
