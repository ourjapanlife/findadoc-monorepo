import * as gqlTypes from '@findadoc/graphql'
import { SUBMISSION_STATUS, type HpsTable, type FacilitiesTable, type SubmissionsTable } from '../typeDefs/kyselyTypes.js'
import { isPublishedLocale, uniqueLocales } from '../languages/publishedLocales.js'
import type { Insertable, Selectable } from 'kysely'
import type { FacilityParent, ProfessionalParent } from '../typeDefs/resolverParents.js'

function toLicenseReview(value: string | null | undefined): gqlTypes.LicenseReviewStatus | null {
    if (value === gqlTypes.LicenseReviewStatus.NeedsReview || value === gqlTypes.LicenseReviewStatus.Confirmed) {
        return value
    }

    return null
}

function toPrimaryLicense(value: string | null | undefined): gqlTypes.Degree | null {
    if (value && (Object.values(gqlTypes.Degree) as string[]).includes(value)) {
        return value as gqlTypes.Degree
    }

    return null
}

// ==== HEALTHCARE PROFESSIONAL MAPPERS ====
// Rows from Kysely are plain objects, so a mapper returns them to GraphQL without copying.

/**
 * Maps an hps row to the GraphQL HealthcareProfessional.
 * The `facilityIds` field resolver loads its facility ids.
 */
export function professionalFromRow(row: Selectable<HpsTable>): ProfessionalParent {
    return {
        id: row.id,
        names: row.names ?? [],
        degrees: row.degrees ?? [],
        primaryLicense: toPrimaryLicense(row.primary_license),
        additionalCredentials: row.additional_credentials ?? [],
        licenseReview: toLicenseReview(row.license_review),
        licenseRecommendation: row.license_recommendation ?? null,
        spokenLanguages: row.spoken_languages ?? [],
        specialties: row.specialties ?? [],
        acceptedInsurance: row.accepted_insurance ?? [],
        createdDate: row.created_date,
        updatedDate: row.updated_date,
        additionalInfoForPatients: row.additional_info_for_patients ?? null
    }
}

/** A professional with facility ids the caller already has, such as a mutation result or an audit log value. */
export function professionalWithFacilityIds(
    row: Selectable<HpsTable>,
    facilityIds: string[]
): gqlTypes.HealthcareProfessional {
    return { ...professionalFromRow(row), facilityIds }
}

// ==== FACILITIES MAPPERS ====

/**
 * Maps a facilities row to the GraphQL Facility.
 * The `healthcareProfessionalIds` field resolver loads its professional ids.
 */
export function facilityFromRow(row: Selectable<FacilitiesTable>): FacilityParent {
    return {
        id: row.id,
        nameEn: row.name_en,
        nameJa: row.name_ja,
        contact: row.contact,
        mapLatitude: row.map_latitude,
        mapLongitude: row.map_longitude,
        createdDate: row.created_date,
        updatedDate: row.updated_date,
        ...paymentOptionFields(row),
        ...supportedLanguageFields(row),
        ...facilityLocationFields(row)
    }
}

/** A facility with professional ids the caller already has, such as a mutation result or an audit log value. */
export function facilityWithProfessionalIds(
    row: Selectable<FacilitiesTable>,
    healthcareProfessionalIds: string[]
): gqlTypes.Facility {
    return { ...facilityFromRow(row), healthcareProfessionalIds }
}

export function paymentOptionFields(row: {
    payment_options?: unknown
}): Pick<gqlTypes.Facility, 'paymentOptions'> {
    let stored = row.payment_options

    if (typeof stored === 'string') {
        try {
            stored = JSON.parse(stored)
        } catch {
            stored = []
        }
    }

    return {
        paymentOptions: Array.isArray(stored) ? stored as gqlTypes.PaymentOption[] : []
    }
}

export function supportedLanguageFields(row: {
    supported_languages?: unknown
}): Pick<gqlTypes.Facility, 'supportedLanguages'> {
    const stored = Array.isArray(row.supported_languages)
        ? row.supported_languages.filter((language): language is gqlTypes.Locale => typeof language === 'string')
        : []

    return {
        supportedLanguages: uniqueLocales(stored).filter(isPublishedLocale) as gqlTypes.Locale[]
    }
}

export function facilityLocationFields(row: {
    city_id?: string | null
    google_place_id?: string | null
    source?: string | null
    verification_status?: string | null
}): Pick<gqlTypes.Facility, 'cityId' | 'googlePlaceId' | 'source' | 'verificationStatus'> {
    return {
        cityId: row.city_id ?? null,
        googlePlaceId: row.google_place_id ?? null,
        source: (row.source ?? null) as gqlTypes.FacilitySource | null,
        verificationStatus: (row.verification_status
            ?? gqlTypes.FacilityVerificationStatus.UnverifiedLocation) as gqlTypes.FacilityVerificationStatus
    }
}

// ==== SUBMISSIONS MAPPERS ====

/** Maps a submissions row to the GraphQL Submission. The three status flags come from `status`. */
export function submissionFromRow(row: Selectable<SubmissionsTable>): gqlTypes.Submission {
    return {
        id: row.id,
        // Nullable in the table. Stored rows have always had them, so they pass through as stored.
        googleMapsUrl: row.google_maps_url as string,
        healthcareProfessionalName: row.healthcare_professional_name as string,
        spokenLanguages: row.spoken_languages as gqlTypes.Locale[],
        facility: row.facility_partial ? {
            ...row.facility_partial,
            healthcareProfessionalIds: row.facility_partial.healthcareProfessionalIds ?? []
        } : undefined,
        healthcareProfessionals: row.healthcare_professionals_partial ?? [],
        isUnderReview: row.status === SUBMISSION_STATUS.UNDER_REVIEW,
        isApproved: row.status === SUBMISSION_STATUS.APPROVED,
        isRejected: row.status === SUBMISSION_STATUS.REJECTED,
        createdDate: row.created_date,
        updatedDate: row.updated_date,
        notes: row.notes ?? undefined
    }
}

/** The insert row for a new, pending submission. */
export function submissionInsertRow(input: gqlTypes.CreateSubmissionInput): Insertable<SubmissionsTable> {
    return {
        status: SUBMISSION_STATUS.PENDING,
        google_maps_url: input.googleMapsUrl ?? '',
        healthcare_professional_name: input.healthcareProfessionalName ?? '',
        spoken_languages: (input.spokenLanguages ?? []) as gqlTypes.Locale[],
        facility_partial: null,
        healthcare_professionals_partial: null,
        hps_id: null,
        facilities_id: null,
        notes: input.notes ?? null,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
    }
}
