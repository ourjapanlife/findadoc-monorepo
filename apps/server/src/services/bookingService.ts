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
import { assembleBookingForm, fieldById, storedSensitivity } from '../booking/formDefinitions.js'
import { BOOKING_UPLOAD_MAX_BYTES } from '../booking/limits.js'
import { retainUntilFromNow } from '../booking/retention.js'
import {
    appointmentEndFromStart,
    availableStarts,
    DEFAULT_APPOINTMENT_DURATION_MINUTES,
    isAlignedToMinutes,
    BOOKING_SLOT_STEP_MINUTES
} from '../booking/schedule.js'
import { sendTransactionalEmail } from '../email/sesClient.js'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'
import { ErrorCode, Result } from '../result.js'
import {
    bookingObjectByteSize,
    bookingUploadExceedsLimit,
    createBookingUploadTarget,
    newUploadId
} from '../storage/objectStorage.js'
import { clinicThemeFromRow } from './clinicSiteService.js'
import { asJsonb } from '../../utils/dbUtils.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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

type PublicClinicRow = {
    id: string
    slug: string
    status: string
    theme: unknown
    name: string | null
}

async function loadPublicClinic(clinicSiteIdOrSlug: string): Promise<PublicClinicRow | undefined> {
    const trimmed = clinicSiteIdOrSlug.trim()
    if (trimmed === '') {
        return undefined
    }

    let query = db.selectFrom('clinic_sites as site')
        .leftJoin('clinic_site_locales as locale', join =>
            join.onRef('locale.clinic_site_id', '=', 'site.id').on('locale.locale', '=', 'en-US'))
        .select([
            'site.id',
            'site.slug',
            'site.status',
            'site.theme',
            'locale.name'
        ])
        .where('site.status', '!=', 'draft')

    if (UUID_PATTERN.test(trimmed)) {
        query = query.where('site.id', '=', trimmed)
    } else if (SLUG_PATTERN.test(trimmed)) {
        query = query.where('site.slug', '=', trimmed)
    } else {
        return undefined
    }

    return query.executeTakeFirst()
}

function bookingFormForClinic(clinic: PublicClinicRow): BookingForm | null {
    const theme = clinicThemeFromRow(clinic.theme)
    return assembleBookingForm({
        clinicSiteId: clinic.id,
        clinicSiteSlug: clinic.slug,
        clinicName: clinic.name ?? clinic.slug,
        themePrimary: theme.primary
    })
}

export async function getBookingForm(clinicSiteIdOrSlug: string): Promise<BookingForm | null> {
    const clinic = await loadPublicClinic(clinicSiteIdOrSlug)
    if (clinic === undefined) {
        return null
    }
    return bookingFormForClinic(clinic)
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
    const clinic = await loadPublicClinic(input.clinicSiteId)
    if (clinic === undefined) {
        return validationError('clinicSiteId')
    }

    const form = bookingFormForClinic(clinic)
    if (form === null) {
        return validationError('clinicSiteId')
    }

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
        clinicSiteId: clinic.id,
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
            clinic_site_id: clinic.id,
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
    return true
}

function collectAnswers(
    form: BookingForm,
    answers: SubmitBookingInput['answers']
): Result<{ storedAnswers: Record<string, string>, uploadIds: string[] }> {
    const answersByField = asAnswerMap(answers)
    const storedAnswers: Record<string, string> = {}
    const uploadIds: string[] = []

    for (const field of form.fields) {
        const answer = answersByField.get(field.id)

        if (field.type === BookingFormFieldType.File) {
            const uploadId = answer?.uploadId?.trim()
            if ((uploadId === undefined || uploadId === '') && field.required) {
                return validationError(field.id)
            }
            if (uploadId !== undefined && uploadId !== '') {
                uploadIds.push(uploadId)
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

    return { data: { storedAnswers, uploadIds }, hasErrors: false }
}

async function assertUploadsBelongToClinic(
    form: BookingForm,
    clinicId: string,
    uploadIds: readonly string[]
): Promise<Result<true>> {
    if (uploadIds.length === 0) {
        return { data: true, hasErrors: false }
    }

    const uploads = await db.selectFrom('booking_uploads')
        .select(['id', 'clinic_site_id', 'field_id', 'booking_submission_id', 'object_key'])
        .where('id', 'in', [...uploadIds])
        .execute()

    if (uploads.length !== uploadIds.length) {
        return validationError('answers')
    }
    for (const upload of uploads) {
        if (upload.clinic_site_id !== clinicId || upload.booking_submission_id !== null) {
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

function requesterEmail(storedAnswers: Record<string, string>): string | undefined {
    const email = storedAnswers.email?.trim()
    if (email === undefined || email === '' || !EMAIL_PATTERN.test(email)) {
        return undefined
    }
    return email
}

/** Professionals linked from the clinic page, when that row has an email. */
async function doctorNotifyAddresses(clinicSiteId: string): Promise<string[]> {
    const rows = await db.selectFrom('clinic_site_doctors')
        .innerJoin('hps', 'hps.id', 'clinic_site_doctors.hp_id')
        .select('hps.email')
        .where('clinic_site_doctors.clinic_site_id', '=', clinicSiteId)
        .where('hps.email', 'is not', null)
        .execute()

    const addresses = new Set<string>()
    for (const row of rows) {
        const email = row.email?.trim()
        if (email !== undefined && email !== '' && EMAIL_PATTERN.test(email)) {
            addresses.add(email)
        }
    }
    return [...addresses]
}

/**
 * Confirmation goes to the person who submitted. A linked doctor is notified
 * separately when that professional has an email. Addresses stay on the server.
 */
async function notifyBookingParties(input: {
    clinic: PublicClinicRow
    bookingId: string
    storedAnswers: Record<string, string>
}): Promise<BookingSubmissionStatus> {
    const requester = requesterEmail(input.storedAnswers)
    if (requester === undefined) {
        return BookingSubmissionStatus.Received
    }

    const clinicName = input.clinic.name ?? input.clinic.slug
    try {
        await sendTransactionalEmail({
            to: requester,
            bookingId: input.bookingId,
            subject: `We received your request · ${clinicName}`,
            textBody: [
                'Your appointment request was received.',
                `Clinic: ${clinicName}`,
                `Reference: ${input.bookingId}`
            ].join('\n')
        })
    } catch (error) {
        logger.error(`Booking confirmation failed for ${input.bookingId}: ${String(error)}`)
        await db.updateTable('booking_submissions')
            .set({
                status: 'failed_notify',
                updated_date: sql`now()`
            })
            .where('id', '=', input.bookingId)
            .execute()
        return BookingSubmissionStatus.FailedNotify
    }

    const doctors = (await doctorNotifyAddresses(input.clinic.id))
        .filter(address => address.toLowerCase() !== requester.toLowerCase())
    for (const doctor of doctors) {
        try {
            await sendTransactionalEmail({
                to: doctor,
                bookingId: input.bookingId,
                subject: `New appointment request · ${clinicName}`,
                textBody: [
                    'A patient requested an appointment. Open the booking in Find a Doc for the full intake.',
                    `Clinic: ${clinicName}`,
                    `Booking id: ${input.bookingId}`,
                    `Name: ${input.storedAnswers.fullName ?? ''}`,
                    `Email: ${requester}`
                ].join('\n')
            })
        } catch (error) {
            logger.error(`Doctor booking notice failed for ${input.bookingId}: ${String(error)}`)
        }
    }

    await db.updateTable('booking_submissions')
        .set({
            status: 'notified',
            notify_email_sent_at: sql`now()`,
            updated_date: sql`now()`
        })
        .where('id', '=', input.bookingId)
        .execute()
    return BookingSubmissionStatus.Notified
}

export async function submitBooking(input: SubmitBookingInput): Promise<Result<BookingSubmissionResult>> {
    const clinic = await loadPublicClinic(input.clinicSiteId)
    if (clinic === undefined) {
        return validationError('clinicSiteId')
    }

    const form = bookingFormForClinic(clinic)
    if (form === null) {
        return validationError('clinicSiteId')
    }

    if (input.formDefinitionId !== form.id || input.formVersion !== form.version) {
        return validationError('formVersion')
    }

    if (!SITE_LOCALES.has(input.locale)) {
        return validationError('locale')
    }

    const collected = collectAnswers(form, input.answers)
    if (collected.hasErrors) {
        return collected as Result<never>
    }

    const { storedAnswers, uploadIds } = collected.data
    const uploadsOk = await assertUploadsBelongToClinic(form, clinic.id, uploadIds)
    if (uploadsOk.hasErrors) {
        return uploadsOk as Result<never>
    }

    let appointmentId: string | null = null
    let startsAt: Date | null = null
    let endsAt: Date | null = null

    if (input.startsAt !== null && input.startsAt !== undefined && input.startsAt.trim() !== '') {
        startsAt = new Date(input.startsAt)
        if (Number.isNaN(startsAt.getTime()) || !isAlignedToMinutes(startsAt, BOOKING_SLOT_STEP_MINUTES)) {
            return validationError('startsAt')
        }
        endsAt = appointmentEndFromStart(startsAt)
        const open = await listAvailableStartsForClinic(clinic.id, startsAt, endsAt)
        const allowed = open.some(start => start.getTime() === startsAt!.getTime())
        if (!allowed) {
            return validationError('startsAt')
        }
    }

    let inserted: { id: string, created_date: string }
    try {
        inserted = await db.transaction().execute(async transaction => {
            const row = await transaction.insertInto('booking_submissions')
                .values({
                    clinic_site_id: clinic.id,
                    form_definition_id: form.id,
                    form_version: form.version,
                    locale: input.locale,
                    answers: asJsonb(storedAnswers),
                    status: 'received',
                    notify_email_sent_at: null
                })
                .returning(['id', 'created_date', 'status'])
                .executeTakeFirstOrThrow()

            if (uploadIds.length > 0) {
                const linked = await transaction.updateTable('booking_uploads')
                    .set({ booking_submission_id: row.id })
                    .where('id', 'in', uploadIds)
                    .where('booking_submission_id', 'is', null)
                    .where('clinic_site_id', '=', clinic.id)
                    .executeTakeFirst()
                if (Number(linked.numUpdatedRows) !== uploadIds.length) {
                    throw new Error('BOOKING_UPLOAD_LINK')
                }
            }

            if (startsAt !== null && endsAt !== null) {
                const appointment = await transaction.insertInto('booking_appointments')
                    .values({
                        clinic_site_id: clinic.id,
                        booking_submission_id: row.id,
                        starts_at: startsAt.toISOString(),
                        ends_at: endsAt.toISOString(),
                        status: 'held'
                    })
                    .returning(['id'])
                    .executeTakeFirstOrThrow()
                appointmentId = appointment.id
            }

            return { id: row.id, created_date: row.created_date }
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'BOOKING_UPLOAD_LINK') {
            return validationError('answers')
        }
        throw error
    }

    const status = await notifyBookingParties({
        clinic,
        bookingId: inserted.id,
        storedAnswers
    })

    return {
        data: {
            id: inserted.id,
            clinicSiteId: clinic.id,
            status,
            appointmentId,
            createdDate: inserted.created_date
        },
        hasErrors: false
    }
}

export async function listAvailableStartsForClinic(
    clinicSiteId: string,
    from: Date,
    to: Date
): Promise<Date[]> {
    const [windows, booked] = await Promise.all([
        db.selectFrom('clinic_availability_windows')
            .select(['starts_at', 'ends_at'])
            .where('clinic_site_id', '=', clinicSiteId)
            .where('starts_at', '<', to.toISOString())
            .where('ends_at', '>', from.toISOString())
            .execute(),
        db.selectFrom('booking_appointments')
            .select(['starts_at', 'ends_at'])
            .where('clinic_site_id', '=', clinicSiteId)
            .where('status', 'in', ['held', 'confirmed'])
            .where('starts_at', '<', to.toISOString())
            .where('ends_at', '>', from.toISOString())
            .execute()
    ])

    return availableStarts({
        windows: windows.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
        booked: booked.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
        rangeStart: from,
        rangeEnd: to,
        durationMs: DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000
    })
}

export async function getAvailableBookingStarts(
    clinicSiteIdOrSlug: string,
    fromIso: string,
    toIso: string
): Promise<string[]> {
    const clinic = await loadPublicClinic(clinicSiteIdOrSlug)
    if (clinic === undefined) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !(to > from)) {
        return []
    }
    const starts = await listAvailableStartsForClinic(clinic.id, from, to)
    return starts.map(start => start.toISOString())
}
