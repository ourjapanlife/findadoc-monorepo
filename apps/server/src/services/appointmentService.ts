import {
    BookingAppointmentStatus,
    type BookingAppointment,
    type CancelBookingByTokenInput,
    type PatientBookingView,
    type UpdateBookingAppointmentStatusInput
} from '@findadoc/graphql'
import { sql } from 'kysely'
import { canReadFacility, canWriteFacility, type BookingAccess } from '../booking/access.js'
import {
    APPOINTMENT_STATUS,
    CANCELLED_BY,
    MAX_STATUS_REASON_LENGTH,
    canPatientCancel,
    canStaffMoveTo,
    type AppointmentStatus
} from '../booking/lifecycle.js'
import { hashPatientToken } from '../booking/links.js'
import { emailFromUnknown, noticeClinic, sendBookingNotice } from '../booking/notifications.js'
import { resolveBookingTarget } from '../booking/target.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'
import { isStaffCalendarRange } from './availabilityService.js'
import { appointmentStatusFromRow, appointmentStatusToRow } from './staffBookingService.js'

/**
 * Appointment lifecycle for staff and patients.
 *
 * Every status change is a compare-and-set on the current status, so two staff
 * clicking at once (or staff and the patient) cannot both win.
 */

const PATIENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/

function invalid(field: string): Result<never> {
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

function parseReason(reason: string | null | undefined): string | null | undefined {
    const trimmed = reason?.trim() ?? ''
    if (trimmed === '') {
        return null
    }
    return trimmed.length > MAX_STATUS_REASON_LENGTH ? undefined : trimmed
}

function answersRecord(value: unknown): Record<string, string> {
    if (typeof value === 'string') {
        return JSON.parse(value) as Record<string, string>
    }
    return (value ?? {}) as Record<string, string>
}

function appointmentFromRow(row: {
    id: string
    booking_submission_id: string | null
    facility_id: string | null
    starts_at: string
    ends_at: string
    duration_minutes: number
    status: string
    patient_name: string | null
    practitioner_id: string | null
}): BookingAppointment {
    return {
        id: row.id,
        bookingSubmissionId: row.booking_submission_id,
        facilityId: row.facility_id,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        durationMinutes: row.duration_minutes,
        status: appointmentStatusFromRow(row.status) ?? BookingAppointmentStatus.Requested,
        patientName: row.patient_name,
        practitionerId: row.practitioner_id
    }
}

function appointmentQuery() {
    return db.selectFrom('booking_appointments as appointment')
        .leftJoin('booking_submissions as booking', 'booking.id', 'appointment.booking_submission_id')
        .select([
            'appointment.id',
            'appointment.booking_submission_id',
            'appointment.facility_id',
            'appointment.clinic_site_id',
            'appointment.starts_at',
            'appointment.ends_at',
            'appointment.duration_minutes',
            'appointment.status',
            'appointment.practitioner_id',
            'booking.answers',
            'booking.locale',
            sql<string | null>`booking.answers->>'fullName'`.as('patient_name')
        ])
}

/** Appointments on one clinic calendar, every status, so staff see cancellations too. */
export async function listClinicAppointments(
    clinicIdOrSlug: string,
    fromIso: string,
    toIso: string,
    access: BookingAccess
): Promise<BookingAppointment[]> {
    const target = await resolveBookingTarget(clinicIdOrSlug)
    if (target === undefined || target.facilityId === null || !canReadFacility(access, target.facilityId)) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (!isStaffCalendarRange(from, to)) {
        return []
    }

    const rows = await appointmentQuery()
        .where('appointment.facility_id', '=', target.facilityId)
        .where('appointment.starts_at', '<', to.toISOString())
        .where('appointment.ends_at', '>', from.toISOString())
        .orderBy('appointment.starts_at')
        .execute()
    return rows.map(appointmentFromRow)
}

const PATIENT_NOTICE: Partial<Record<AppointmentStatus, { subject: string, line: string }>> = {
    [APPOINTMENT_STATUS.CONFIRMED]: {
        subject: 'Your appointment is confirmed',
        line: 'The clinic confirmed your appointment.'
    },
    [APPOINTMENT_STATUS.DECLINED]: {
        subject: 'Your appointment request was declined',
        line: 'The clinic could not take this request. The time is free again; you may request another.'
    },
    [APPOINTMENT_STATUS.CANCELLED]: {
        subject: 'Your appointment was cancelled',
        line: 'The clinic cancelled this appointment.'
    }
}

/** Staff confirm, decline, cancel, or complete. Declined and cancelled free the slot. */
export async function updateAppointmentStatus(
    input: UpdateBookingAppointmentStatusInput,
    access: BookingAccess,
    actorSub: string | undefined
): Promise<Result<BookingAppointment>> {
    const next = appointmentStatusToRow(input.status)
    if (next === APPOINTMENT_STATUS.REQUESTED) {
        return invalid('status')
    }
    const reason = parseReason(input.reason)
    if (reason === undefined) {
        return invalid('reason')
    }

    const current = await appointmentQuery()
        .where('appointment.id', '=', input.appointmentId)
        .executeTakeFirst()
    if (current === undefined || !canWriteFacility(access, current.facility_id)) {
        return notFound('appointmentId')
    }
    if (!canStaffMoveTo(current.status, next)) {
        return invalid('status')
    }

    const updated = await db.updateTable('booking_appointments')
        .set({
            status: next,
            status_changed_at: sql`now()`,
            status_changed_by: actorSub ?? null,
            status_reason: reason,
            cancelled_by: next === APPOINTMENT_STATUS.CANCELLED ? CANCELLED_BY.CLINIC : null,
            updated_date: sql`now()`
        })
        .where('id', '=', current.id)
        .where('status', '=', current.status)
        .executeTakeFirst()
    if (Number(updated.numUpdatedRows) !== 1) {
        // Someone else changed it first.
        return invalid('status')
    }

    const notice = PATIENT_NOTICE[next]
    const patientEmail = emailFromUnknown(answersRecord(current.answers).email)
    if (notice !== undefined && patientEmail !== undefined && current.booking_submission_id !== null) {
        const target = await resolveBookingTarget(current.facility_id ?? current.clinic_site_id ?? '')
        await sendBookingNotice({
            to: patientEmail,
            bookingId: current.booking_submission_id,
            subject: `${notice.subject} · ${target?.clinicName ?? 'Find a Doc, Japan'}`,
            lines: [
                notice.line,
                `Time (UTC): ${new Date(current.starts_at).toISOString()}`,
                ...(reason !== null ? [`Note from the clinic: ${reason}`] : []),
                `Reference: ${current.booking_submission_id}`,
                'Sent through Find a Doc, Japan.'
            ]
        })
    }

    return { data: appointmentFromRow({ ...current, status: next }), hasErrors: false }
}

async function appointmentForToken(token: string) {
    const trimmed = token.trim()
    if (!PATIENT_TOKEN_PATTERN.test(trimmed)) {
        return undefined
    }
    return db.selectFrom('booking_submissions as booking')
        .leftJoin('booking_appointments as appointment', 'appointment.booking_submission_id', 'booking.id')
        .select([
            'booking.id as booking_id',
            'booking.facility_id',
            'booking.clinic_site_id',
            'booking.answers',
            'appointment.id as appointment_id',
            'appointment.status',
            'appointment.starts_at',
            'appointment.ends_at'
        ])
        .where('booking.cancel_token_hash', '=', hashPatientToken(trimmed))
        .executeTakeFirst()
}

type TokenRow = NonNullable<Awaited<ReturnType<typeof appointmentForToken>>>

async function patientView(row: TokenRow): Promise<PatientBookingView> {
    const target = await resolveBookingTarget(row.facility_id ?? row.clinic_site_id ?? '')
    const startsAt = row.starts_at === null ? null : new Date(row.starts_at)
    return {
        clinicName: target?.clinicName ?? '',
        startsAt: startsAt?.toISOString() ?? null,
        endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
        status: appointmentStatusFromRow(row.status),
        canCancel: row.status !== null && startsAt !== null && canPatientCancel(row.status, startsAt)
    }
}

/** The patient's own booking. An unknown token reads as null. */
export async function getPatientBooking(token: string): Promise<PatientBookingView | null> {
    const row = await appointmentForToken(token)
    return row === undefined ? null : patientView(row)
}

export async function cancelBookingByToken(input: CancelBookingByTokenInput): Promise<Result<PatientBookingView>> {
    const reason = parseReason(input.reason)
    if (reason === undefined) {
        return invalid('reason')
    }
    const row = await appointmentForToken(input.token)
    if (row === undefined || row.appointment_id === null || row.status === null || row.starts_at === null) {
        return notFound('token')
    }
    if (!canPatientCancel(row.status, new Date(row.starts_at))) {
        return invalid('token')
    }

    const updated = await db.updateTable('booking_appointments')
        .set({
            status: APPOINTMENT_STATUS.CANCELLED,
            status_changed_at: sql`now()`,
            status_changed_by: null,
            status_reason: reason,
            cancelled_by: CANCELLED_BY.PATIENT,
            updated_date: sql`now()`
        })
        .where('id', '=', row.appointment_id)
        .where('status', '=', row.status)
        .executeTakeFirst()
    if (Number(updated.numUpdatedRows) !== 1) {
        return invalid('token')
    }

    const cancelled = { ...row, status: APPOINTMENT_STATUS.CANCELLED }
    const view = await patientView(cancelled)
    const answers = answersRecord(row.answers)
    await noticeClinic({
        target: { facilityId: row.facility_id, clinicSiteId: row.clinic_site_id },
        bookingId: row.booking_id,
        patientEmail: emailFromUnknown(answers.email),
        subject: `Appointment cancelled by the patient · ${view.clinicName}`,
        lines: [
            'The patient cancelled this appointment. The time is free again on your calendar.',
            `Time (UTC): ${new Date(row.starts_at).toISOString()}`,
            `Booking id: ${row.booking_id}`,
            `Name: ${answers.fullName ?? ''}`,
            ...(reason !== null ? [`Reason: ${reason}`] : [])
        ]
    })

    return { data: view, hasErrors: false }
}
