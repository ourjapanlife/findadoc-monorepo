import {
    BookingFormFieldType,
    BookingSubmissionStatus,
    type Locale,
    type BookingForm,
    type BookingPractitioner,
    type BookingSubmissionResult,
    type BookingUploadUrl,
    type CreateBookingUploadUrlInput,
    type SubmitBookingInput
} from '@findadoc/graphql'
import { sql } from 'kysely'
import {
    assembleBookingForm,
    chooseFormDefinitionId,
    dateAnswerIsValid,
    type AssembledBookingForm,
    fieldById,
    fieldIsShown,
    isOfferedFormId,
    storedSensitivity
} from '../booking/formDefinitions.js'
import { APPOINTMENT_STATUS, SLOT_HOLDING_STATUSES } from '../booking/lifecycle.js'
import { clinicRequestEmail, isSiteLocale, patientRequestEmail } from '../booking/emailCopy.js'
import {
    activeInterpreters,
    interpreterHolds,
    interpreterStarts,
    type Interpreter
} from '../booking/interpretation.js'
import { BOOKING_UPLOAD_MAX_BYTES } from '../booking/limits.js'
import { clinicDashboardUrl, newPatientToken, patientBookingUrl } from '../booking/links.js'
import { noticeClinic, sendBookingNotice } from '../booking/notifications.js'
import {
    clinicLanguages,
    facilityLanguagesFor,
    interpreterCoverage,
    listFacilityPractitioners,
    parseRequestedLanguages,
    scheduleLanes,
    type InterpreterCoverage,
    type ScheduleLane
} from '../booking/practitioners.js'
import { retainUntilFromNow } from '../booking/retention.js'
import {
    appointmentEndFromStart,
    availableStarts,
    expandWeeklyHours,
    isAlignedToMinutes,
    isPublicSlotRange,
    resolveAppointmentDuration,
    slotStepMinutes
} from '../booking/schedule.js'
import {
    bookingLockKey,
    lockClinicBookings,
    resolvePublicBookingTarget,
    type BookingTarget
} from '../booking/target.js'
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
/** Upcoming `requested` appointments one email may hold at one clinic (#160). */
export const MAX_OPEN_REQUESTS_PER_EMAIL = 3
const ALLOWED_UPLOAD_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
])

function bookingFormForTarget(target: BookingTarget, formDefinitionId?: string | null): AssembledBookingForm {
    return assembleBookingForm({
        formDefinitionId: formDefinitionId ?? target.formDefinitionIds[0],
        facilityId: target.facilityId,
        clinicSiteId: target.clinicSiteId,
        clinicSiteSlug: target.clinicSiteSlug,
        clinicName: target.clinicName,
        themePrimary: target.themePrimary,
        allowedDurations: target.allowedDurations,
        defaultDuration: target.defaultDuration
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
    const context = await choiceContext(target)
    return {
        ...bookingFormForTarget(target, chooseFormDefinitionId(target.formDefinitionIds, formId)),
        practitioners: context.practitioners,
        languages: context.offered,
        offersInterpretation: context.coverage.length > 0,
        // Only languages the clinic offers, all known Locale values, so a stray stored value cannot break the page.
        interpreters: context.coverage.map(interpreter => ({
            languages: context.offered.filter(language => interpreter.languages.includes(language))
        }))
    }
}

/** The clinic's doctors, languages, and the interpreters a patient may book with (#205). */
async function choiceContext(target: BookingTarget, executor: AvailabilityExecutor = db): Promise<{
    practitioners: BookingPractitioner[]
    facilityLanguages: string[]
    offered: Locale[]
    interpreters: Map<string, Interpreter>
    coverage: InterpreterCoverage[]
}> {
    const [practitioners, facilityLanguages, interpreters] = await Promise.all([
        listFacilityPractitioners(target.facilityId),
        facilityLanguagesFor(target.facilityId),
        activeInterpreters(target.facilityId, executor)
    ])
    const offered = clinicLanguages(practitioners, facilityLanguages, interpreters.map(item => item.languages))
    return {
        practitioners,
        facilityLanguages,
        offered,
        interpreters: new Map(interpreters.map(interpreter => [interpreter.id, interpreter])),
        coverage: interpreterCoverage(interpreters, offered)
    }
}

type LaneChoice = { lanes: ScheduleLane[], languages: string[], interpreters: Map<string, Interpreter> }

/** The schedules a patient's doctor and language choice may book on. Undefined when the choice is not valid. */
async function lanesForChoice(
    target: BookingTarget,
    practitionerIdInput: string | null | undefined,
    languagesInput: readonly string[] | null | undefined,
    executor: AvailabilityExecutor = db
): Promise<LaneChoice | undefined> {
    const languages = parseRequestedLanguages(languagesInput)
    if (languages === undefined) {
        return undefined
    }
    const practitionerId = practitionerIdInput?.trim() || null
    const context = await choiceContext(target, executor)
    const lanes = scheduleLanes({
        practitioners: context.practitioners,
        facilityLanguages: context.facilityLanguages,
        practitionerId,
        languages,
        interpreters: context.coverage
    })
    return lanes === undefined ? undefined : { lanes, languages, interpreters: context.interpreters }
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
    if (field.type === BookingFormFieldType.Date) {
        return dateAnswerIsValid(raw, field)
    }
    return true
}

/** Validated answers to store, and the uploads they name. Exported for tests. */
export function collectAnswers(
    form: Pick<AssembledBookingForm, 'fields'>,
    answers: SubmitBookingInput['answers']
): Result<{ storedAnswers: Record<string, string>, uploads: AnswerUpload[] }> {
    const answersByField = asAnswerMap(answers)
    const storedAnswers: Record<string, string> = {}
    const uploads: AnswerUpload[] = []

    const answerFor = (fieldId: string) => answersByField.get(fieldId)?.value?.trim() ?? ''

    for (const field of form.fields) {
        // A field hidden by its condition is not required, and anything sent for it is dropped.
        if (!fieldIsShown(field, answerFor)) {
            continue
        }
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
    form: AssembledBookingForm,
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
    durationMinutes: number
    locale: string
    patientToken: string
    languages: readonly string[]
    interpreterLabel: string | null
}): Promise<BookingSubmissionStatus> {
    const requester = requesterEmail(input.storedAnswers)
    const clinicName = input.target.clinicName

    const patientSent = requester === undefined
        ? false
        : await sendBookingNotice({
            to: requester,
            bookingId: input.bookingId,
            email: patientRequestEmail({
                locale: input.locale,
                clinicName,
                startsAt: input.startsAt,
                durationMinutes: input.durationMinutes,
                reference: input.bookingId,
                manageUrl: patientBookingUrl(input.patientToken, input.locale)
            })
        })

    await noticeClinic({
        target: input.target,
        bookingId: input.bookingId,
        patientEmail: requester,
        email: clinicRequestEmail({
            clinicName,
            startsAt: input.startsAt,
            durationMinutes: input.durationMinutes,
            bookingId: input.bookingId,
            patientName: input.storedAnswers.fullName ?? '',
            patientEmail: requester ?? '',
            languages: input.languages,
            interpreterLabel: input.interpreterLabel,
            dashboardUrl: input.target.facilityId === null ? null : clinicDashboardUrl(input.target.facilityId)
        })
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
    // Both boxes on the Book page (#173). The consent time is stored with the request.
    if (input.confirmedInJapan !== true) {
        return validationError('confirmedInJapan')
    }
    if (input.healthDataConsent !== true) {
        return validationError('healthDataConsent')
    }
    const healthDataConsentedAt = new Date().toISOString()

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

    if (!isSiteLocale(input.locale)) {
        return validationError('locale')
    }

    const durationMinutes = resolveAppointmentDuration(
        input.durationMinutes,
        target.allowedDurations,
        target.defaultDuration
    )
    if (durationMinutes === undefined) {
        return validationError('durationMinutes')
    }

    // A start off the clinic's grid (9:15 when it offers only 30 and 60) is refused here,
    // not only by the open-start check, so a hand-made request cannot leave a gap.
    const startsAt = new Date(input.startsAt)
    if (Number.isNaN(startsAt.getTime()) || !isAlignedToMinutes(startsAt, slotStepMinutes(target.allowedDurations))) {
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
    const choice = await lanesForChoice(target, practitionerId, input.spokenLanguages)
    if (choice === undefined) {
        return validationError(practitionerId === null ? 'spokenLanguages' : 'practitionerId')
    }

    const serviceKey = parseServiceKey(input.service)
    if (input.service !== null && input.service !== undefined && input.service.trim() !== '' && serviceKey === null) {
        return validationError('service')
    }

    const patientToken = newPatientToken()
    let appointmentId: string | null = null
    let inserted: { id: string, created_date: string, interpreterLabel: string | null }
    try {
        inserted = await db.transaction().execute(async transaction => {
            await lockClinicBookings(transaction, bookingLockKey(target))
            // Plan again under the lock: an interpreter save or the on/off switch takes the
            // same lock, so these settings cannot change before the visit is held (#205).
            const locked = await lanesForChoice(target, practitionerId, input.spokenLanguages, transaction)
            const openCache: OpenStartsCache = new Map()

            // The first schedule that still has this start free takes the visit.
            let lane: ScheduleLane | undefined
            for (const candidate of locked?.lanes ?? []) {
                const open = await laneStarts({
                    target,
                    from: startsAt,
                    to: endsAt,
                    durationMinutes,
                    lane: candidate,
                    interpreters: locked?.interpreters ?? new Map(),
                    executor: transaction,
                    openCache
                })
                if (open.some(start => start.getTime() === startsAt.getTime())) {
                    lane = candidate
                    break
                }
            }
            if (lane === undefined) {
                throw new Error('BOOKING_SLOT_TAKEN')
            }

            const email = requesterEmail(storedAnswers)
            if (email !== undefined) {
                const openRequests = await countOpenRequestsForEmail(target, email, transaction)
                if (openRequests >= MAX_OPEN_REQUESTS_PER_EMAIL) {
                    throw new Error('BOOKING_OPEN_REQUEST_LIMIT')
                }
            }

            const row = await transaction.insertInto('booking_submissions')
                .values({
                    facility_id: target.facilityId,
                    clinic_site_id: target.clinicSiteId,
                    practitioner_id: practitionerId ?? lane.practitionerId,
                    service_key: serviceKey,
                    spoken_languages: choice.languages,
                    form_definition_id: form.id,
                    form_version: form.version,
                    locale: input.locale,
                    answers: asJsonb(storedAnswers),
                    status: 'received',
                    notify_email_sent_at: null,
                    cancel_token_hash: patientToken.hash,
                    health_data_consented_at: healthDataConsentedAt
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
                    practitioner_id: lane.practitionerId,
                    interpreter_id: lane.interpreterId,
                    starts_at: startsAt.toISOString(),
                    ends_at: endsAt.toISOString(),
                    duration_minutes: durationMinutes,
                    status: APPOINTMENT_STATUS.REQUESTED
                })
                .returning(['id'])
                .executeTakeFirstOrThrow()
            appointmentId = appointment.id

            const interpreterLabel = lane.interpreterId === null
                ? null
                : locked?.interpreters.get(lane.interpreterId)?.label ?? null
            return { id: row.id, created_date: row.created_date, interpreterLabel }
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'BOOKING_UPLOAD_LINK') {
            return validationError('answers')
        }
        if (error instanceof Error && error.message === 'BOOKING_SLOT_TAKEN') {
            return validationError('startsAt')
        }
        if (error instanceof Error && error.message === 'BOOKING_OPEN_REQUEST_LIMIT') {
            return {
                data: undefined as never,
                hasErrors: true,
                errors: [{ field: 'email', errorCode: ErrorCode.OPEN_REQUEST_LIMIT, httpStatus: 429 }]
            }
        }
        throw error
    }

    const status = await notifyBookingParties({
        target,
        bookingId: inserted.id,
        storedAnswers,
        startsAt,
        durationMinutes,
        locale: input.locale,
        patientToken: patientToken.token,
        languages: choice.languages,
        interpreterLabel: inserted.interpreterLabel
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

/** Requests from this email that the clinic has not answered and that have not ended. Case-insensitive. */
async function countOpenRequestsForEmail(
    target: BookingTarget,
    email: string,
    executor: AvailabilityExecutor
): Promise<number> {
    let query = executor.selectFrom('booking_appointments as appointment')
        .innerJoin('booking_submissions as booking', 'booking.id', 'appointment.booking_submission_id')
        .select(eb => eb.fn.countAll<string>().as('count'))
        .where('appointment.status', '=', APPOINTMENT_STATUS.REQUESTED)
        .where('appointment.ends_at', '>', new Date().toISOString())
        .where(sql<string>`lower(booking.answers->>'email')`, '=', email.toLowerCase())

    if (target.facilityId !== null) {
        query = query.where('appointment.facility_id', '=', target.facilityId)
    } else if (target.clinicSiteId !== null) {
        query = query.where('appointment.clinic_site_id', '=', target.clinicSiteId)
    } else {
        return 0
    }

    const row = await query.executeTakeFirstOrThrow()
    return Number(row.count)
}

/**
 * Open starts on one schedule: a doctor's (practitionerId) or the clinic's (null).
 * A clinic-wide closure closes every doctor too.
 */
async function listAvailableStartsForTarget(
    target: BookingTarget,
    from: Date,
    to: Date,
    durationMinutes: number,
    practitionerId: string | null,
    executor: AvailabilityExecutor = db
): Promise<Date[]> {
    let windowQuery = executor.selectFrom('clinic_availability_windows')
        .select(['starts_at', 'ends_at'])
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
        .where('practitioner_id', practitionerId === null ? 'is' : '=', practitionerId)
    let bookedQuery = executor.selectFrom('booking_appointments')
        .select(['starts_at', 'ends_at'])
        .where('status', 'in', SLOT_HOLDING_STATUSES)
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
        .where('practitioner_id', practitionerId === null ? 'is' : '=', practitionerId)

    if (target.facilityId !== null) {
        windowQuery = windowQuery.where('facility_id', '=', target.facilityId)
        bookedQuery = bookedQuery.where('facility_id', '=', target.facilityId)
    } else if (target.clinicSiteId !== null) {
        windowQuery = windowQuery.where('clinic_site_id', '=', target.clinicSiteId)
        bookedQuery = bookedQuery.where('clinic_site_id', '=', target.clinicSiteId)
    } else {
        return []
    }

    // Weekly hours and closures are keyed by the facility. A clinic site without one has neither.
    const facilityId = target.facilityId
    const [windows, booked, weekly, closures] = await Promise.all([
        windowQuery.execute(),
        bookedQuery.execute(),
        facilityId === null
            ? []
            : executor.selectFrom('clinic_weekly_hours')
                .select(['weekday', 'start_minute', 'end_minute'])
                .where('facility_id', '=', facilityId)
                .where('practitioner_id', practitionerId === null ? 'is' : '=', practitionerId)
                .execute(),
        facilityId === null
            ? []
            : executor.selectFrom('clinic_availability_closures')
                .select(['starts_at', 'ends_at'])
                .where('facility_id', '=', facilityId)
                .where('starts_at', '<', to.toISOString())
                .where('ends_at', '>', from.toISOString())
                .where(eb => practitionerId === null
                    ? eb('practitioner_id', 'is', null)
                    : eb.or([eb('practitioner_id', 'is', null), eb('practitioner_id', '=', practitionerId)]))
                .execute()
    ])

    const weeklyWindows = expandWeeklyHours(
        weekly.map(row => ({ weekday: row.weekday, startMinute: row.start_minute, endMinute: row.end_minute })),
        from,
        to
    )

    return availableStarts({
        windows: [
            ...weeklyWindows,
            ...windows.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) }))
        ],
        booked: booked.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
        closed: closures.map(row => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
        rangeStart: from,
        rangeEnd: to,
        durationMs: durationMinutes * 60 * 1000,
        stepMinutes: slotStepMinutes(target.allowedDurations)
    })
}

/** Open starts by schedule (practitioner id, null for clinic time), for one call. */
type OpenStartsCache = Map<string | null, Date[]>

/**
 * Open starts on one lane: the schedule's open starts and, when the lane holds an
 * interpreter, only those inside the interpreter's hours and under their capacity
 * (#205). Submit calls this inside the clinic lock, so the capacity count is current.
 */
async function laneStarts(input: {
    target: BookingTarget
    from: Date
    to: Date
    durationMinutes: number
    lane: ScheduleLane
    interpreters: ReadonlyMap<string, Interpreter>
    executor?: AvailabilityExecutor
    /** One per operation: interpreted lanes reuse their schedule's starts. */
    openCache?: OpenStartsCache
}): Promise<Date[]> {
    const executor = input.executor ?? db
    let open = input.openCache?.get(input.lane.practitionerId)
    if (open === undefined) {
        open = await listAvailableStartsForTarget(
            input.target,
            input.from,
            input.to,
            input.durationMinutes,
            input.lane.practitionerId,
            executor
        )
        input.openCache?.set(input.lane.practitionerId, open)
    }
    if (input.lane.interpreterId === null) {
        return open
    }
    const interpreter = input.interpreters.get(input.lane.interpreterId)
    if (interpreter === undefined || open.length === 0) {
        return []
    }
    const durationMs = input.durationMinutes * 60 * 1000
    const rangeEnd = new Date(input.to.getTime() + durationMs)
    return interpreterStarts({
        starts: open,
        durationMs,
        interpreter,
        held: await interpreterHolds(interpreter.id, input.from, rangeEnd, executor),
        rangeStart: input.from,
        rangeEnd: input.to
    })
}

export async function getAvailableBookingStarts(
    clinicIdOrSlug: string,
    fromIso: string,
    toIso: string,
    durationMinutesInput?: number | null,
    practitionerId?: string | null,
    spokenLanguages?: readonly string[] | null
): Promise<string[]> {
    const target = await resolvePublicBookingTarget(clinicIdOrSlug)
    if (target === undefined) {
        return []
    }
    const durationMinutes = resolveAppointmentDuration(
        durationMinutesInput,
        target.allowedDurations,
        target.defaultDuration
    )
    if (durationMinutes === undefined) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !isPublicSlotRange(from, to)) {
        return []
    }
    const choice = await lanesForChoice(target, practitionerId, spokenLanguages)
    if (choice === undefined) {
        return []
    }
    // One start may be free on several schedules; the patient sees it once.
    const starts = new Set<number>()
    const openCache: OpenStartsCache = new Map()
    for (const lane of choice.lanes) {
        const open = await laneStarts({
            target, from, to, durationMinutes, lane, interpreters: choice.interpreters, openCache
        })
        for (const start of open) {
            starts.add(start.getTime())
        }
    }
    return [...starts].sort((a, b) => a - b).map(start => new Date(start).toISOString())
}
