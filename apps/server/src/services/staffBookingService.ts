import {
    BookingAppointmentStatus,
    BookingCancelledBy,
    BookingFieldSensitivity,
    BookingSubmissionStatus,
    type BookingSubmissionDetail,
    type BookingSubmissionListItem,
    type BookingSubmissionSearchFilters,
    type BookingUploadDownloadUrl
} from '@findadoc/graphql'
import { sql } from 'kysely'
import { canReadFacility, readableFacilityIds, type BookingAccess } from '../booking/access.js'
import { APPOINTMENT_STATUS, CANCELLED_BY, type AppointmentStatus } from '../booking/lifecycle.js'
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

const APPOINTMENT_STATUS_TO_GQL: Record<AppointmentStatus, BookingAppointmentStatus> = {
    [APPOINTMENT_STATUS.REQUESTED]: BookingAppointmentStatus.Requested,
    [APPOINTMENT_STATUS.CONFIRMED]: BookingAppointmentStatus.Confirmed,
    [APPOINTMENT_STATUS.DECLINED]: BookingAppointmentStatus.Declined,
    [APPOINTMENT_STATUS.CANCELLED]: BookingAppointmentStatus.Cancelled,
    [APPOINTMENT_STATUS.COMPLETED]: BookingAppointmentStatus.Completed
}

export function appointmentStatusFromRow(status: string | null | undefined): BookingAppointmentStatus | null {
    if (status === null || status === undefined) {
        return null
    }
    return APPOINTMENT_STATUS_TO_GQL[status as AppointmentStatus] ?? null
}

export function appointmentStatusToRow(status: BookingAppointmentStatus): AppointmentStatus {
    const entry = Object.entries(APPOINTMENT_STATUS_TO_GQL).find(([, value]) => value === status)
    return entry![0] as AppointmentStatus
}

function cancelledByFromRow(value: string | null): BookingCancelledBy | null {
    if (value === CANCELLED_BY.PATIENT) {
        return BookingCancelledBy.Patient
    }
    if (value === CANCELLED_BY.CLINIC) {
        return BookingCancelledBy.Clinic
    }
    return null
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

function notFound(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.NOT_FOUND, httpStatus: 404 }]
    }
}

/** Facility ids the filters may reach, or undefined when nothing is readable. */
function scopedFacilityIds(
    filters: BookingSubmissionSearchFilters,
    access: BookingAccess
): string[] | 'all' | undefined {
    const readable = readableFacilityIds(access)
    if (filters.facilityId) {
        return canReadFacility(access, filters.facilityId) ? [filters.facilityId] : undefined
    }
    if (readable === 'all') {
        return 'all'
    }
    return readable.length > 0 ? readable : undefined
}

function listQuery(filters: BookingSubmissionSearchFilters, facilityIds: string[] | 'all') {
    let query = db.selectFrom('booking_submissions as booking')
        .leftJoin('clinic_sites as site', 'site.id', 'booking.clinic_site_id')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'site.id').on('locale.locale', '=', 'en-US'))
        .leftJoin('facilities as facility', 'facility.id', 'booking.facility_id')
        .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')

    if (facilityIds !== 'all') {
        query = query.where('booking.facility_id', 'in', facilityIds)
    }
    if (filters.clinicSiteId) {
        query = query.where('booking.clinic_site_id', '=', filters.clinicSiteId)
    }
    if (filters.appointmentStatus) {
        query = query.where('appointment.status', '=', appointmentStatusToRow(filters.appointmentStatus))
    }

    return query
}

export async function searchBookingSubmissions(
    filters: BookingSubmissionSearchFilters,
    access: BookingAccess
): Promise<BookingSubmissionListItem[]> {
    const facilityIds = scopedFacilityIds(filters, access)
    if (facilityIds === undefined) {
        return []
    }
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const offset = Math.max(filters.offset ?? 0, 0)

    const rows = await listQuery(filters, facilityIds)
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
            'appointment.id as appointment_id',
            'appointment.status as appointment_status',
            'appointment.starts_at',
            'appointment.ends_at',
            sql<string | null>`booking.answers->>'fullName'`.as('patient_name')
        ])
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
        appointmentId: row.appointment_id,
        appointmentStatus: appointmentStatusFromRow(row.appointment_status),
        patientName: row.patient_name,
        createdDate: row.created_date,
        updatedDate: row.updated_date,
        hasIdentityUploads: identitySet.has(row.id)
    }))
}

export async function countBookingSubmissions(
    filters: BookingSubmissionSearchFilters,
    access: BookingAccess
): Promise<number> {
    const facilityIds = scopedFacilityIds(filters, access)
    if (facilityIds === undefined) {
        return 0
    }
    const row = await listQuery(filters, facilityIds)
        .select(eb => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst()
    return Number(row?.count ?? 0)
}

export async function getBookingSubmissionDetail(
    id: string,
    access: BookingAccess
): Promise<BookingSubmissionDetail | null> {
    const row = await db.selectFrom('booking_submissions as booking')
        .leftJoin('clinic_sites as site', 'site.id', 'booking.clinic_site_id')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'site.id').on('locale.locale', '=', 'en-US'))
        .leftJoin('facilities as facility', 'facility.id', 'booking.facility_id')
        .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')
        .leftJoin('hps as practitioner', 'practitioner.id', 'booking.practitioner_id')
        .select([
            'booking.id',
            'booking.clinic_site_id',
            'booking.facility_id',
            'booking.practitioner_id',
            'practitioner.names as practitioner_names',
            'booking.spoken_languages',
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
            'appointment.id as appointment_id',
            'appointment.status as appointment_status',
            'appointment.cancelled_by',
            'appointment.status_reason',
            'appointment.starts_at',
            'appointment.ends_at'
        ])
        .where('booking.id', '=', id)
        .executeTakeFirst()

    // Another clinic's booking reads as missing, not forbidden.
    if (row === undefined || !canReadFacility(access, row.facility_id)) {
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
        appointmentId: row.appointment_id,
        appointmentStatus: appointmentStatusFromRow(row.appointment_status),
        cancelledBy: cancelledByFromRow(row.cancelled_by),
        statusReason: row.status_reason,
        practitionerId: row.practitioner_id,
        practitionerNames: row.practitioner_names ?? [],
        spokenLanguages: (row.spoken_languages ?? []) as BookingSubmissionDetail['spokenLanguages'],
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

/** Identity documents are downloadable until purged, but never inlined in list payloads. */
export async function createStaffBookingDownloadUrl(
    uploadId: string,
    apiBaseUrl: string,
    access: BookingAccess
): Promise<Result<BookingUploadDownloadUrl>> {
    const upload = await db.selectFrom('booking_uploads')
        .select(['id', 'object_key', 'purged_at', 'facility_id', 'booking_submission_id'])
        .where('id', '=', uploadId)
        .executeTakeFirst()

    if (upload === undefined || !canReadFacility(access, upload.facility_id)) {
        return notFound('uploadId')
    }
    // An upload that never joined a submission is a patient's abandoned draft, not staff data.
    if (upload.purged_at !== null || upload.booking_submission_id === null) {
        return validationError('uploadId')
    }

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
