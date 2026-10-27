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
import { assembleBookingForm, fieldById } from '../booking/formDefinitions.js'
import { sendTransactionalEmail } from '../email/sesClient.js'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'
import { ErrorCode, Result } from '../result.js'
import { createBookingUploadTarget, newUploadId } from '../storage/objectStorage.js'
import { clinicThemeFromRow } from './clinicSiteService.js'
import { envVariables } from '../../utils/environmentVariables.js'
import { asJsonb } from '../../utils/dbUtils.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
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
        themePrimary: theme.primary,
        notifyEmailFallback: envVariables.bookingNotifyEmail() ?? null
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
    if (input.byteSize !== null && input.byteSize !== undefined) {
        if (input.byteSize < 0 || input.byteSize > maxBytes) {
            return validationError('byteSize')
        }
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
        apiBaseUrl
    })

    await db.insertInto('booking_uploads')
        .values({
            id: uploadId,
            clinic_site_id: clinic.id,
            booking_submission_id: null,
            field_id: field.id,
            object_key: signed.objectKey,
            content_type: contentType,
            file_name: fileName,
            byte_size: input.byteSize ?? null
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
        .select(['id', 'clinic_site_id', 'field_id', 'booking_submission_id'])
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
    }
    return { data: true, hasErrors: false }
}

async function notifyClinicOfBooking(input: {
    form: BookingForm
    clinic: PublicClinicRow
    bookingId: string
    locale: string
    storedAnswers: Record<string, string>
}): Promise<BookingSubmissionStatus> {
    const notifyTo = input.form.notifyEmail?.trim() || envVariables.bookingNotifyEmail()?.trim()
    if (!notifyTo) {
        return BookingSubmissionStatus.Received
    }

    try {
        await sendTransactionalEmail({
            to: notifyTo,
            subject: `New booking · ${input.clinic.name ?? input.clinic.slug}`,
            textBody: [
                `Clinic: ${input.clinic.name ?? input.clinic.slug} (${input.clinic.slug})`,
                `Booking id: ${input.bookingId}`,
                `Locale: ${input.locale}`,
                `Form: ${input.form.id} v${input.form.version}`,
                '',
                'Answers:',
                ...Object.entries(input.storedAnswers).map(([key, value]) => `- ${key}: ${value}`)
            ].join('\n')
        })
        await db.updateTable('booking_submissions')
            .set({
                status: 'notified',
                notify_email_sent_at: sql`now()`,
                updated_date: sql`now()`
            })
            .where('id', '=', input.bookingId)
            .execute()
        return BookingSubmissionStatus.Notified
    } catch (error) {
        logger.error(`Booking notify failed for ${input.bookingId}: ${String(error)}`)
        await db.updateTable('booking_submissions')
            .set({
                status: 'failed_notify',
                updated_date: sql`now()`
            })
            .where('id', '=', input.bookingId)
            .execute()
        return BookingSubmissionStatus.FailedNotify
    }
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

    const inserted = await db.insertInto('booking_submissions')
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
        await db.updateTable('booking_uploads')
            .set({ booking_submission_id: inserted.id })
            .where('id', 'in', uploadIds)
            .execute()
    }

    const status = await notifyClinicOfBooking({
        form,
        clinic,
        bookingId: inserted.id,
        locale: input.locale,
        storedAnswers
    })

    return {
        data: {
            id: inserted.id,
            clinicSiteId: clinic.id,
            status,
            createdDate: inserted.created_date
        },
        hasErrors: false
    }
}
