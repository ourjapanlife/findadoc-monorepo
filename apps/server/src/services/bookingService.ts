import {
    BookingFormFieldType,
    BookingSubmissionStatus,
    type BookingForm,
    type BookingSubmissionResult,
    type BookingUploadUrl,
    type CreateBookingUploadUrlInput,
    type SubmitBookingInput
} from '@findadoc/graphql'
import { sql } from 'kysely'
import {
    assembleBookingForm,
    chooseFormDefinitionId,
    fieldById,
    isOfferedFormId,
    storedSensitivity
} from '../booking/formDefinitions.js'
import { APPOINTMENT_STATUS, SLOT_HOLDING_STATUSES } from '../booking/lifecycle.js'
import { BOOKING_UPLOAD_MAX_BYTES } from '../booking/limits.js'
import { newPatientToken, patientBookingUrl } from '../booking/links.js'
import { noticeClinic, sendBookingNotice } from '../booking/notifications.js'
import { retainUntilFromNow } from '../booking/retention.js'
import {
    appointmentEndFromStart,
    availableStarts,
    BOOKING_SLOT_STEP_MINUTES,
    isAlignedToMinutes,
    isPublicSlotRange,
    resolveAppointmentDuration
} from '../booking/schedule.js'
import { bookingLockKey, resolvePublicBookingTarget, type BookingTarget } from '../booking/target.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'
import {
    bookingObjectByteSize,
    bookingUploadExceedsLimit,
    createBookingUploadTarget,
    newUploadId
} from '../storage/objectStorage.js'
import { asJsonb } from '../../utils/dbUtils.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_UPLOAD_BYTES = BOOKING_UPLOAD_MAX_BYTES
const SITE_LOCALES = new Set([
    'en-US', 'ja-JP', 'zh-CN', 'vi-VN', 'ko-KR', 'tl-PH',
    'pt-BR', 'fr-FR', 'ru-RU', 'de-DE', 'it-IT'
])
const ALLOWED_UPLOAD_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
])

function bookingFormForTarget(target: BookingTarget, formDefinitionId?: string | null): BookingForm {
    return assembleBookingForm({
        formDefinitionId: formDefinitionId ?? target.formDefinitionIds[0],
        facilityId: target.facilityId,
        clinicSiteId: target.clinicSiteId,
        clinicSiteSlug: target.clinicSiteSlug,
        clinicName: target.clinicName,
        themePrimary: target.themePrimary,
        allowedDurations: target.allowedDurations
    })
}

export async function getBookingForm(
    clinicIdOrSlug: string,
    formId?: string | null
): Promise<BookingForm | null> {
    const target = await resolvePublicBookingTarget(clinicIdOrSlug)
    if (target === undefined) {
        return null
    }
    return bookingFormForTarget(target, chooseFormDefinitionId(target.formDefinitionIds, formId))
}

function validationError(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{
            field,
            errorCode: ErrorCode.INVALID_INPUT,
            httpStatus: 400
        }]
    }
}

export async function createBookingUploadUrl(
    input: CreateBookingUploadUrlInput,
    apiBaseUrl: string
): Promise<Result<BookingUploadUrl>> {
    const target = await resolvePublicBookingTarget(input.clinicSiteId)
    if (target === undefined) {
        return validationError('clinicSiteId')
    }

    const formId = input.formDefinitionId?.trim() || target.formDefinitionIds[0]!
    if (!isOfferedFormId(target.formDefinitionIds, formId)) {
        return validationError('formDefinitionId')
    }
    const form = bookingFormForTarget(target, formId)
    const field = fieldById(form, input.fieldId)
    if (field === undefined || field.type !== BookingFormFieldType.File) {
        return validationError('fieldId')
    }

    const contentType = input.contentType.trim().toLowerCase()
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
        return validationError('contentType')
    }
    if (field.accept !== null && field.accept !== undefined && field.accept !== '') {
        const accepted = field.accept.split(',').map(part => part.trim().toLowerCase())
        if (!accepted.includes(contentType)) {
            return validationError('contentType')
        }
    }

    const maxBytes = field.maxBytes ?? MAX_UPLOAD_BYTES
    if (input.byteSize === null || input.byteSize === undefined
        || !Number.isInteger(input.byteSize)
        || input.byteSize <= 0
        || input.byteSize > maxBytes) {
        return validationError('byteSize')
    }

    const fileName = input.fileName.trim()
    if (fileName === '') {
        return validationError('fileName')
    }

    const uploadId = newUploadId()
    const signed = await createBookingUploadTarget({
        clinicSiteId: target.clinicSiteId ?? target.facilityId ?? 'clinic',
        uploadId,
        contentType,
        fileName,
        byteSize: input.byteSize,
        apiBaseUrl
    })

    const sensitivity = storedSensitivity(field)
    await db.insertInto('booking_uploads')
        .values({
            id: uploadId,
            facility_id: target.facilityId,
            clinic_site_id: target.clinicSiteId,
            booking_submission_id: null,
            field_id: field.id,
            object_key: signed.objectKey,
            content_type: contentType,
            file_name: fileName,
            byte_size: input.byteSize,
            sensitivity,
            retain_until: retainUntilFromNow(sensitivity).toISOString(),
            purged_at: null
        })
        .execute()

    return {
        data: {
            uploadId,
            objectKey: signed.objectKey,
            uploadUrl: signed.uploadUrl,
            headers: signed.headers,
            expiresAt: signed.expiresAt
        },
        hasErrors: false
    }
}

function asAnswerMap(answers: SubmitBookingInput['answers']): Map<string, { value?: string | null, uploadId?: string | null }> {
    const map = new Map<string, { value?: string | null, uploadId?: string | null }>()
    for (const answer of answers) {
        map.set(answer.fieldId, { value: answer.value, uploadId: answer.uploadId })
    }
    return map
}

function scalarAnswerIsValid(
    field: NonNullable<ReturnType<typeof fieldById>>,
    raw: string
): boolean {
    if (field.maxLength !== null && field.maxLength !== undefined && raw.length > field.maxLength) {
        return false
    }
    if (field.type === BookingFormFieldType.Email) {
        return EMAIL_PATTERN.test(raw)
    }
    if (field.type === BookingFormFieldType.Phone) {
        return raw.replace(/\D/g, '').length >= 8
    }
    if (field.type === BookingFormFieldType.Number) {
        const number = Number(raw)
        if (!Number.isFinite(number)) {
            return false
        }
        if (field.min !== null && field.min !== undefined && number < field.min) {
            return false
        }
        if (field.max !== null && field.max !== undefined && number > field.max) {
            return false
        }
    }
    if (field.type === BookingFormFieldType.Select) {
        const options = field.options ?? []
        return options.some(option => option.value === raw)
    }
    return true
}

function collectAnswers(
    form: BookingForm,
    answers: SubmitBookingInput['answers']
): Result<{ storedAnswers: Record<string, string>, uploads: AnswerUpload[] }> {
    const answersByField = asAnswerMap(answers)
    const storedAnswers: Record<string, string> = {}
    const uploads: AnswerUpload[] = []

    for (const field of form.fields) {
        const answer = answersByField.get(field.id)

        if (field.type === BookingFormFieldType.File) {
            const uploadId = answer?.uploadId?.trim()
            if ((uploadId === undefined || uploadId === '') && field.required) {
                return validationError(field.id)
            }
            if (uploadId !== undefined && uploadId !== '') {
                uploads.push({ fieldId: field.id, uploadId })
                storedAnswers[field.id] = uploadId
            }
            continue
        }

        const raw = answer?.value?.trim() ?? ''
        if (raw === '' && field.required) {
            return validationError(field.id)
        }
        if (raw === '') {
            continue
        }
        if (!scalarAnswerIsValid(field, raw)) {
            return validationError(field.id)
        }
        storedAnswers[field.id] = raw
    }

    return { data: { storedAnswers, uploads }, hasErrors: false }
}

type AnswerUpload = { fieldId: string, uploadId: string }

async function assertUploadsBelongToClinic(
    form: BookingForm,
    target: BookingTarget,
    answerUploads: readonly AnswerUpload[]
): Promise<Result<true>> {
    if (answerUploads.length === 0) {
        return { data: true, hasErrors: false }
    }

    const uploadIds = answerUploads.map(item => item.uploadId)
    const uploads = await db.selectFrom('booking_uploads')
        .select(['id', 'clinic_site_id', 'facility_id', 'field_id', 'booking_submission_id', 'object_key'])
        .where('id', 'in', uploadIds)
        .execute()

    if (uploads.length !== uploadIds.length) {
        return validationError('answers')
    }
    for (const upload of uploads) {
        // A file uploaded for one field (the photo) may not answer another (the insurance card).
        const answered = answerUploads.find(item => item.uploadId === upload.id)
        if (answered === undefined || answered.fieldId !== upload.field_id) {
            return validationError('answers')
        }
        const siteMatch = target.clinicSiteId !== null && upload.clinic_site_id === target.clinicSiteId
        const facilityMatch = target.facilityId !== null && upload.facility_id === target.facilityId
        if ((!siteMatch && !facilityMatch) || upload.booking_submission_id !== null) {
            return validationError('answers')
        }
        const field = fieldById(form, upload.field_id)
        if (field === undefined || field.type !== BookingFormFieldType.File) {
            return validationError('answers')
        }
        const byteSize = await bookingObjectByteSize(upload.object_key)
        if (byteSize === null || bookingUploadExceedsLimit(byteSize, field.maxBytes)) {
            return validationError('answers')
        }
    }
    return { data: true, hasErrors: false }
}

async function assertPractitionerAtFacility(
    facilityId: string | null,
    practitionerId: string | null
): Promise<Result<true>> {
    if (practitionerId === null) {
        return { data: true, hasErrors: false }
    }
    if (facilityId === null) {
        return validationError('practitionerId')
    }
    const row = await db.selectFrom('hps_facilities')
        .select('hps_id')
        .where('hps_id', '=', practitionerId)
        .where('facilities_id', '=', facilityId)
        .executeTakeFirst()
    if (row === undefined) {
        return validationError('practitionerId')
    }
    return { data: true, hasErrors: false }
}

function requesterEmail(storedAnswers: Record<string, string>): string | undefined {
    const email = storedAnswers.email?.trim()
    if (email === undefined || email === '' || !EMAIL_PATTERN.test(email)) {
        return undefined
    }
    return email
}

/**
 * Patient receipt (with the private manage link), then the clinic notice.
 * The clinic is told even when the patient email fails.
 */
async function notifyBookingParties(input: {
    target: BookingTarget
    bookingId: string
    storedAnswers: Record<string, string>
    startsAt: Date
    locale: string
    patientToken: string
}): Promise<BookingSubmissionStatus> {
    const requester = requesterEmail(input.storedAnswers)
    const clinicName = input.target.clinicName
    const when = input.startsAt.toISOString()

    const patientSent = requester === undefined
        ? false
        : await sendBookingNotice({
            to: requester,
            bookingId: input.bookingId,
            subject: `We received your request · ${clinicName}`,
            lines: [
                'Your appointment request was received. The clinic will confirm it.',
                'Sent through Find a Doc, Japan.',
                `Clinic: ${clinicName}`,
                `Requested time (UTC): ${when}`,
                `Reference: ${input.bookingId}`,
                '',
                'To see or cancel this request, open your private link:',
                patientBookingUrl(input.patientToken, input.locale)
            ]
        })

    await noticeClinic({
        target: input.target,
        bookingId: input.bookingId,
        patientEmail: requester,
        subject: `New appointment request · ${clinicName}`,
        lines: [
            'A patient requested an appointment. Confirm or decline it in your Find a Doc, Japan booking dashboard.',
            `Clinic: ${clinicName}`,
            `Requested time (UTC): ${when}`,
            `Booking id: ${input.bookingId}`,
            `Name: ${input.storedAnswers.fullName ?? ''}`,
            `Email: ${requester ?? ''}`
        ]
    })

    if (requester === undefined) {
        return BookingSubmissionStatus.Received
    }

    await db.updateTable('booking_submissions')
        .set({
            status: patientSent ? 'notified' : 'failed_notify',
            ...(patientSent ? { notify_email_sent_at: sql`now()` } : {}),
            updated_date: sql`now()`
        })
        .where('id', '=', input.bookingId)
        .execute()
    return patientSent ? BookingSubmissionStatus.Notified : BookingSubmissionStatus.FailedNotify
}

function parseServiceKey(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
        return null
    }
    const trimmed = value.trim()
    if (trimmed === '' || trimmed.length > 80) {
        return null
    }
    return trimmed
}

export async function submitBooking(input: SubmitBookingInput): Promise<Result<BookingSubmissionResult>> {
    const target = await resolvePublicBookingTarget(input.clinicSiteId)
    if (target === undefined) {
        return validationError('clinicSiteId')
    }

    if (!isOfferedFormId(target.formDefinitionIds, input.formDefinitionId)) {
        return validationError('formVersion')
    }
    const form = bookingFormForTarget(target, input.formDefinitionId)

    if (input.formVersion !== form.version) {
        return validationError('formVersion')
    }

    if (!SITE_LOCALES.has(input.locale)) {
        return validationError('locale')
    }

    const durationMinutes = resolveAppointmentDuration(input.durationMinutes, target.allowedDurations)
    if (durationMinutes === undefined) {
        return validationError('durationMinutes')
    }

    const startsAt = new Date(input.startsAt)
    if (Number.isNaN(startsAt.getTime()) || !isAlignedToMinutes(startsAt, BOOKING_SLOT_STEP_MINUTES)) {
        return validationError('startsAt')
    }
    const endsAt = appointmentEndFromStart(startsAt, durationMinutes)

    const collected = collectAnswers(form, input.answers)
    if (collected.hasErrors) {
        return collected as Result<never>
    }

    const { storedAnswers, uploads } = collected.data
    const uploadIds = uploads.map(item => item.uploadId)
    const uploadsOk = await assertUploadsBelongToClinic(form, target, uploads)
    if (uploadsOk.hasErrors) {
        return uploadsOk as Result<never>
    }

    const practitionerId = input.practitionerId?.trim() || null
    const practitionerOk = await assertPractitionerAtFacility(target.facilityId, practitionerId)
    if (practitionerOk.hasErrors) {
        return practitionerOk as Result<never>
    }

    const serviceKey = parseServiceKey(input.service)
    if (input.service !== null && input.service !== undefined && input.service.trim() !== '' && serviceKey === null) {
        return validationError('service')
    }

    const patientToken = newPatientToken()
    let appointmentId: string | null = null
    let inserted: { id: string, created_date: string }
    try {
        inserted = await db.transaction().execute(async transaction => {
            await sql`SELECT pg_advisory_xact_lock(hashtext(${bookingLockKey(target)}))`.execute(transaction)

            const open = await listAvailableStartsForTarget(target, startsAt, endsAt, durationMinutes, transaction)
            const allowed = open.some(start => start.getTime() === startsAt.getTime())
            if (!allowed) {
                throw new Error('BOOKING_SLOT_TAKEN')
            }

            const row = await transaction.insertInto('booking_submissions')
                .values({
                    facility_id: target.facilityId,
                    clinic_site_id: target.clinicSiteId,
                    practitioner_id: practitionerId,
                    service_key: serviceKey,
                    form_definition_id: form.id,
                    form_version: form.version,
                    locale: input.locale,
                    answers: asJsonb(storedAnswers),
                    status: 'received',
                    notify_email_sent_at: null,
                    cancel_token_hash: patientToken.hash
                })
                .returning(['id', 'created_date', 'status'])
                .executeTakeFirstOrThrow()

            if (uploadIds.length > 0) {
                let linkQuery = transaction.updateTable('booking_uploads')
                    .set({ booking_submission_id: row.id })
                    .where('id', 'in', uploadIds)
                    .where('booking_submission_id', 'is', null)
                if (target.facilityId !== null) {
                    linkQuery = linkQuery.where('facility_id', '=', target.facilityId)
                } else if (target.clinicSiteId !== null) {
                    linkQuery = linkQuery.where('clinic_site_id', '=', target.clinicSiteId)
                }
                const linked = await linkQuery.executeTakeFirst()
                if (Number(linked.numUpdatedRows) !== uploadIds.length) {
                    throw new Error('BOOKING_UPLOAD_LINK')
                }
            }

            const appointment = await transaction.insertInto('booking_appointments')
                .values({
                    facility_id: target.facilityId,
                    clinic_site_id: target.clinicSiteId,
                    booking_submission_id: row.id,
                    starts_at: startsAt.toISOString(),
                    ends_at: endsAt.toISOString(),
                    duration_minutes: durationMinutes,
                    status: APPOINTMENT_STATUS.REQUESTED
                })
                .returning(['id'])
                .executeTakeFirstOrThrow()
            appointmentId = appointment.id

            return { id: row.id, created_date: row.created_date }
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'BOOKING_UPLOAD_LINK') {
            return validationError('answers')
        }
        if (error instanceof Error && error.message === 'BOOKING_SLOT_TAKEN') {
            return validationError('startsAt')
        }
        throw error
    }

    const status = await notifyBookingParties({
        target,
        bookingId: inserted.id,
        storedAnswers,
        startsAt,
        locale: input.locale,
        patientToken: patientToken.token
    })

    return {
        data: {
            id: inserted.id,
            clinicSiteId: target.clinicSiteId,
            facilityId: target.facilityId,
            status,
            appointmentId,
            createdDate: inserted.created_date,
            manageToken: patientToken.token
        },
        hasErrors: false
    }
}

type AvailabilityExecutor = Pick<typeof db, 'selectFrom'>

async function listAvailableStartsForTarget(
    target: BookingTarget,
    from: Date,
    to: Date,
    durationMinutes: number,
    executor: AvailabilityExecutor = db
): Promise<Date[]> {
    let windowQuery = executor.selectFrom('clinic_availability_windows')
        .select(['starts_at', 'ends_at'])
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
    let bookedQuery = executor.selectFrom('booking_appointments')
        .select(['starts_at', 'ends_at'])
        .where('status', 'in', SLOT_HOLDING_STATUSES)
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())

    if (target.facilityId !== null) {
        windowQuery = windowQuery.where('facility_id', '=', target.facilityId)
        bookedQuery = bookedQuery.where('facility_id', '=', target.facilityId)
    } else if (target.clinicSiteId !== null) {
        windowQuery = windowQuery.where('clinic_site_id', '=', target.clinicSiteId)
        bookedQuery = bookedQuery.where('clinic_site_id', '=', target.clinicSiteId)
    } else {
        return []
    }

    const [windows, booked] = await Promise.all([
        windowQuery.execute(),
        bookedQuery.execute()
    ])

    return availableStarts({
        windows: windows.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
        booked: booked.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
        rangeStart: from,
        rangeEnd: to,
        durationMs: durationMinutes * 60 * 1000
    })
}

export async function getAvailableBookingStarts(
    clinicIdOrSlug: string,
    fromIso: string,
    toIso: string,
    durationMinutesInput?: number | null
): Promise<string[]> {
    const target = await resolvePublicBookingTarget(clinicIdOrSlug)
    if (target === undefined) {
        return []
    }
    const durationMinutes = resolveAppointmentDuration(durationMinutesInput, target.allowedDurations)
    if (durationMinutes === undefined) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !isPublicSlotRange(from, to)) {
        return []
    }
    const starts = await listAvailableStartsForTarget(target, from, to, durationMinutes)
    return starts.map(start => start.toISOString())
}
