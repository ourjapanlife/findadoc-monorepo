import {
    BookingFieldSensitivity,
    BookingSubmissionStatus,
    type BookingSubmissionDetail,
    type BookingSubmissionListItem,
    type BookingSubmissionSearchFilters,
    type BookingUploadDownloadUrl
} from '@findadoc/graphql'
import { isIdentityDocumentSensitivity } from '../booking/retention.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'
import { createBookingDownloadUrl } from '../storage/objectStorage.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function statusFromRow(status: string): BookingSubmissionStatus {
    if (status === 'notified') {
        return BookingSubmissionStatus.Notified
    }
    if (status === 'failed_notify') {
        return BookingSubmissionStatus.FailedNotify
    }
    return BookingSubmissionStatus.Received
}

function sensitivityFromRow(value: string): BookingFieldSensitivity {
    if (value === 'identity_document') {
        return BookingFieldSensitivity.IdentityDocument
    }
    if (value === 'medical') {
        return BookingFieldSensitivity.Medical
    }
    return BookingFieldSensitivity.Standard
}

function validationError(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
    }
}

function listQuery(filters: BookingSubmissionSearchFilters) {
    let query = db.selectFrom('booking_submissions as booking')
        .leftJoin('clinic_sites as site', 'site.id', 'booking.clinic_site_id')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'site.id').on('locale.locale', '=', 'en-US'))
        .leftJoin('facilities as facility', 'facility.id', 'booking.facility_id')
        .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')
        .select([
            'booking.id',
            'booking.clinic_site_id',
            'booking.facility_id',
            'booking.locale',
            'booking.status',
            'booking.form_definition_id',
            'booking.form_version',
            'booking.created_date',
            'booking.updated_date',
            'site.slug',
            'locale.name as clinic_name',
            'facility.name_en as facility_name',
            'appointment.starts_at',
            'appointment.ends_at'
        ])

    if (filters.clinicSiteId) {
        query = query.where('booking.clinic_site_id', '=', filters.clinicSiteId)
    }
    if (filters.facilityId) {
        query = query.where('booking.facility_id', '=', filters.facilityId)
    }

    return query
}

export async function searchBookingSubmissions(
    filters: BookingSubmissionSearchFilters
): Promise<BookingSubmissionListItem[]> {
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const offset = Math.max(filters.offset ?? 0, 0)

    const rows = await listQuery(filters)
        .orderBy('booking.created_date', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()

    const ids = rows.map(row => row.id)
    const identityUploads = ids.length === 0
        ? []
        : await db.selectFrom('booking_uploads')
            .select(['booking_submission_id'])
            .where('booking_submission_id', 'in', ids)
            .where('sensitivity', '=', 'identity_document')
            .where('purged_at', 'is', null)
            .execute()
    const identitySet = new Set(
        identityUploads
            .map(row => row.booking_submission_id)
            .filter((id): id is string => typeof id === 'string')
    )

    return rows.map(row => ({
        id: row.id,
        clinicSiteId: row.clinic_site_id,
        facilityId: row.facility_id,
        clinicSiteSlug: row.slug,
        clinicName: row.clinic_name ?? row.facility_name ?? row.slug ?? row.facility_id ?? row.id,
        locale: row.locale,
        status: statusFromRow(row.status),
        formDefinitionId: row.form_definition_id,
        formVersion: row.form_version,
        startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
        endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
        createdDate: row.created_date,
        updatedDate: row.updated_date,
        hasIdentityUploads: identitySet.has(row.id)
    }))
}

export async function countBookingSubmissions(
    filters: BookingSubmissionSearchFilters
): Promise<number> {
    let query = db.selectFrom('booking_submissions')
        .select(db.fn.countAll<number>().as('count'))

    if (filters.clinicSiteId) {
        query = query.where('clinic_site_id', '=', filters.clinicSiteId)
    }
    if (filters.facilityId) {
        query = query.where('facility_id', '=', filters.facilityId)
    }

    const row = await query.executeTakeFirst()
    return Number(row?.count ?? 0)
}

export async function getBookingSubmissionDetail(id: string): Promise<BookingSubmissionDetail | null> {
    const row = await db.selectFrom('booking_submissions as booking')
        .leftJoin('clinic_sites as site', 'site.id', 'booking.clinic_site_id')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'site.id').on('locale.locale', '=', 'en-US'))
        .leftJoin('facilities as facility', 'facility.id', 'booking.facility_id')
        .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')
        .select([
            'booking.id',
            'booking.clinic_site_id',
            'booking.facility_id',
            'booking.practitioner_id',
            'booking.service_key',
            'booking.locale',
            'booking.status',
            'booking.form_definition_id',
            'booking.form_version',
            'booking.answers',
            'booking.created_date',
            'booking.updated_date',
            'site.slug',
            'locale.name as clinic_name',
            'facility.name_en as facility_name',
            'appointment.starts_at',
            'appointment.ends_at'
        ])
        .where('booking.id', '=', id)
        .executeTakeFirst()

    if (row === undefined) {
        return null
    }

    const answersRecord = typeof row.answers === 'string'
        ? JSON.parse(row.answers) as Record<string, string>
        : (row.answers ?? {})

    const uploads = await db.selectFrom('booking_uploads')
        .select([
            'id',
            'field_id',
            'file_name',
            'content_type',
            'sensitivity',
            'retain_until',
            'purged_at',
            'byte_size'
        ])
        .where('booking_submission_id', '=', id)
        .orderBy('created_date')
        .execute()

    return {
        id: row.id,
        clinicSiteId: row.clinic_site_id,
        facilityId: row.facility_id,
        clinicSiteSlug: row.slug,
        clinicName: row.clinic_name ?? row.facility_name ?? row.slug ?? row.facility_id ?? row.id,
        locale: row.locale,
        status: statusFromRow(row.status),
        formDefinitionId: row.form_definition_id,
        formVersion: row.form_version,
        startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
        endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
        practitionerId: row.practitioner_id,
        service: row.service_key,
        createdDate: row.created_date,
        updatedDate: row.updated_date,
        answers: Object.entries(answersRecord).map(([fieldId, value]) => ({
            fieldId,
            value: typeof value === 'string' ? value : null
        })),
        uploads: uploads.map(upload => ({
            id: upload.id,
            fieldId: upload.field_id,
            fileName: upload.file_name,
            contentType: upload.content_type,
            sensitivity: sensitivityFromRow(upload.sensitivity),
            retainUntil: upload.retain_until,
            purgedAt: upload.purged_at,
            byteSize: upload.byte_size
        }))
    }
}

export async function createStaffBookingDownloadUrl(
    uploadId: string,
    apiBaseUrl: string
): Promise<Result<BookingUploadDownloadUrl>> {
    const upload = await db.selectFrom('booking_uploads')
        .select(['id', 'object_key', 'purged_at', 'sensitivity'])
        .where('id', '=', uploadId)
        .executeTakeFirst()

    if (upload === undefined) {
        return validationError('uploadId')
    }
    if (upload.purged_at !== null) {
        return validationError('uploadId')
    }

    // Identity documents still downloadable until purged, but never embedded in list payloads.
    void isIdentityDocumentSensitivity(upload.sensitivity)

    const signed = await createBookingDownloadUrl({
        objectKey: upload.object_key,
        apiBaseUrl
    })

    return {
        data: {
            uploadId: upload.id,
            downloadUrl: signed.downloadUrl,
            expiresAt: signed.expiresAt
        },
        hasErrors: false
    }
}
