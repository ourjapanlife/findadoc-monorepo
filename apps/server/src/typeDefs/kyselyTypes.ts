import type { ColumnType, Generated } from 'kysely'
import * as gqlTypes from '@findadoc/graphql'

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
    map_latitude: number | null
    map_longitude: number | null
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
    online: Generated<boolean>
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

/** A login account. */
export interface UserTable {
    id: Generated<string>
    display_name: string | null
    profile_pic_url: string | null
    created_date: Generated<string>
    updated_date: string | null
}

/**
 * A clinic-owned page. id is what an account and a future CRM attach to.
 * facility_id is the directory listing for this page.
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

/** Clinic-chosen booking config. The intake form is Find a Doc owned. */
export interface BookingSettingsTable {
    facility_id: string
    clinic_site_id: string | null
    form_definition_id: string
    allowed_durations: number[]
    created_date: Generated<string>
    updated_date: Generated<string>
}

/** Patient booking intake. answers is the scalar map; files are booking_uploads rows. */
export interface BookingSubmissionsTable {
    id: Generated<string>
    facility_id: string | null
    clinic_site_id: string | null
    practitioner_id: string | null
    service_key: string | null
    form_definition_id: string
    form_version: number
    locale: string
    answers: ColumnType<Record<string, string>, Record<string, string>, Record<string, string>>
    status: string
    notify_email_sent_at: string | null
    created_date: Generated<string>
    updated_date: Generated<string>
}

/** One uploaded file for a booking field. object_key is under uploads/booking/. */
export interface BookingUploadsTable {
    id: Generated<string>
    facility_id: string | null
    clinic_site_id: string | null
    booking_submission_id: string | null
    field_id: string
    object_key: string
    content_type: string
    file_name: string
    byte_size: number | null
    sensitivity: string
    retain_until: string | null
    purged_at: string | null
    created_date: Generated<string>
}

/** Staff-painted availability. 30-minute aligned. */
export interface ClinicAvailabilityWindowsTable {
    id: Generated<string>
    facility_id: string | null
    clinic_site_id: string | null
    starts_at: string
    ends_at: string
    created_by: string | null
    created_date: Generated<string>
    updated_date: Generated<string>
}

/** Patient appointment inside availability. 15-minute start alignment. */
export interface BookingAppointmentsTable {
    id: Generated<string>
    facility_id: string | null
    clinic_site_id: string | null
    booking_submission_id: string | null
    starts_at: string
    ends_at: string
    duration_minutes: number
    status: string
    created_date: Generated<string>
    updated_date: Generated<string>
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
    user: UserTable
    clinic_sites: ClinicSitesTable
    clinic_memberships: ClinicMembershipsTable
    clinic_site_languages: ClinicSiteLanguagesTable
    clinic_site_doctors: ClinicSiteDoctorsTable
    clinic_site_locales: ClinicSiteLocalesTable
    booking_settings: BookingSettingsTable
    booking_submissions: BookingSubmissionsTable
    booking_uploads: BookingUploadsTable
    clinic_availability_windows: ClinicAvailabilityWindowsTable
    booking_appointments: BookingAppointmentsTable
}

/**
 * Enums from the database
 */
export type ActionTypeEnum = 'CREATE' | 'UPDATE' | 'DELETE'
export type ObjectTypeEnum = 'Facility' | 'HealthcareProfessional' | 'Submission'
export type SchemaVersionEnum = 'V1'
export type SubmissionStatusEnum = 'pending' | 'under_review' | 'approved' | 'rejected'

/** Submission status values as stored. GraphQL exposes them as isUnderReview, isApproved and isRejected. */
export const SUBMISSION_STATUS = {
    PENDING: 'pending',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected'
} as const satisfies Record<string, SubmissionStatusEnum>
