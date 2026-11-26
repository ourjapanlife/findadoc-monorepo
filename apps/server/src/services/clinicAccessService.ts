import {
    ClinicMemberRole,
    type BookingClinic,
    type BookingFormType,
    type BookingSettings,
    type ClinicMember,
    type DeleteResult,
    type InviteClinicMemberInput,
    type SetBookingInterpretationInput,
    type SetBookingSmsInput,
    type UpdateBookingSettingsInput
} from '@findadoc/graphql'
import { sql } from 'kysely'
import {
    MEMBERSHIP_ROLE,
    isClinicOwner,
    isClinicMember,
    type BookingAccess,
    type MembershipRole
} from '../booking/access.js'
import {
    SHOWCASE_BOOKING_FORM_ID,
    formSourceById,
    formsTakePayment,
    listFormSources
} from '../booking/formDefinitions.js'
import {
    canChangeInterpretation,
    listInterpreters,
    offersInterpretation,
    setInterpretation
} from '../booking/interpretation.js'
import { clinicLanguages, facilityLanguagesFor, listFacilityPractitioners } from '../booking/practitioners.js'
import { OPEN_REQUEST_STATUSES } from '../booking/lifecycle.js'
import { isAppointmentDuration, resolveDefaultDuration } from '../booking/schedule.js'
import { canChangeSms, offersSms, setSms } from '../booking/sms.js'
import { resolveBookingTarget, settingsForFacility } from '../booking/target.js'
import { db } from '../kyselyClient.js'
import { errorLogFields, logger } from '../logger.js'
import { UUID_REGEX } from '../validation/validateFacility.js'
import { ErrorCode, Result } from '../result.js'

/**
 * Clinic booking accounts: who belongs to which facility, and what the clinic
 * offers. Admins set up the account: they invite anyone and turn interpretation on,
 * but read no booking unless they are a member (#192). An owner invites and removes staff.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 254

function invalid(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
    }
}

function forbidden(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.FORBIDDEN, httpStatus: 403 }]
    }
}

function roleToGql(role: MembershipRole): ClinicMemberRole {
    return role === MEMBERSHIP_ROLE.OWNER ? ClinicMemberRole.Owner : ClinicMemberRole.Staff
}

function roleFromGql(role: ClinicMemberRole): MembershipRole {
    return role === ClinicMemberRole.Owner ? MEMBERSHIP_ROLE.OWNER : MEMBERSHIP_ROLE.STAFF
}

export function listBookingFormTypes(): BookingFormType[] {
    return listFormSources().map(source => ({
        id: source.id,
        version: source.version,
        labelKey: source.labelKey
    }))
}

/** Appointments still waiting on the clinic (requested or pending payment) per facility, in one query. */
async function requestedCountsFor(facilityIds: string[]): Promise<Map<string, number>> {
    if (facilityIds.length === 0) {
        return new Map()
    }
    const rows = await db.selectFrom('booking_appointments')
        .select(['facility_id', eb => eb.fn.countAll<string>().as('count')])
        .where('facility_id', 'in', facilityIds)
        .where('status', 'in', OPEN_REQUEST_STATUSES)
        .groupBy('facility_id')
        .execute()
    return new Map(rows
        .filter((row): row is typeof row & { facility_id: string } => row.facility_id !== null)
        .map(row => [row.facility_id, Number(row.count)]))
}

/** A member opens the clinic; an admin opens it to set up its account. */
function canOpenClinic(access: BookingAccess, facilityId: string): boolean {
    return isClinicMember(access, facilityId) || access.isAdmin
}

async function bookingClinicFor(
    facilityId: string,
    access: BookingAccess,
    requestedCount: number
): Promise<BookingClinic | null> {
    if (!canOpenClinic(access, facilityId)) {
        return null
    }
    const target = await resolveBookingTarget(facilityId)
    if (target === undefined || target.facilityId !== facilityId) {
        return null
    }
    const role = access.memberships.get(facilityId)
    return {
        facilityId,
        clinicName: target.clinicName,
        clinicSiteSlug: target.clinicSiteSlug,
        role: role === undefined ? null : roleToGql(role),
        isAdmin: access.isAdmin,
        requestedCount,
        takesPayment: formsTakePayment(target.formDefinitionIds),
        branding: target.branding
    }
}

async function bookingClinicsFor(facilityIds: string[], access: BookingAccess): Promise<BookingClinic[]> {
    const openable = facilityIds.filter(facilityId => canOpenClinic(access, facilityId))
    // The waiting count is booking data, so it only counts the clinics the user is a member of.
    const counts = await requestedCountsFor(openable.filter(facilityId => isClinicMember(access, facilityId)))
    const clinics = await Promise.all(
        openable.map(facilityId => bookingClinicFor(facilityId, access, counts.get(facilityId) ?? 0))
    )
    return clinics
        .filter((clinic): clinic is BookingClinic => clinic !== null)
        .sort((a, b) => a.clinicName.localeCompare(b.clinicName))
}

export async function getBookingClinic(facilityId: string, access: BookingAccess): Promise<BookingClinic | null> {
    const [clinic] = await bookingClinicsFor([facilityId], access)
    return clinic ?? null
}

/** Clinics this user is a member of. Admins open others by id to set up their accounts. */
export async function listMyBookingClinics(access: BookingAccess): Promise<BookingClinic[]> {
    return bookingClinicsFor([...access.memberships.keys()], access)
}

/**
 * Every facility set up for booking: it has booking settings, a clinic member, or a hosted
 * clinic site. Admins only, to set up accounts; anyone else gets an empty list. The waiting
 * count stays 0 for a clinic the admin is not a member of.
 */
export async function listAllBookingClinics(access: BookingAccess): Promise<BookingClinic[]> {
    if (!access.isAdmin) {
        return []
    }
    const [settings, members, sites] = await Promise.all([
        db.selectFrom('booking_settings').select('facility_id').execute(),
        db.selectFrom('clinic_memberships').select('facility_id').where('facility_id', 'is not', null).execute(),
        db.selectFrom('clinic_sites').select('facility_id').where('facility_id', 'is not', null).execute()
    ])
    const facilityIds = [...new Set([...settings, ...members, ...sites]
        .map(row => row.facility_id)
        .filter((facilityId): facilityId is string => facilityId !== null))]
    return bookingClinicsFor(facilityIds, access)
}

function memberFromRow(row: {
    id: string
    facility_id: string | null
    invited_email: string | null
    role: string
    auth0_sub: string | null
    created_date: string
}): ClinicMember {
    return {
        id: row.id,
        facilityId: row.facility_id ?? '',
        email: row.invited_email,
        role: row.role === MEMBERSHIP_ROLE.OWNER ? ClinicMemberRole.Owner : ClinicMemberRole.Staff,
        claimed: row.auth0_sub !== null,
        createdDate: row.created_date
    }
}

export async function listClinicMembers(facilityId: string, access: BookingAccess): Promise<ClinicMember[]> {
    // The clinic owner manages their staff. An admin sets up any clinic's owners and staff.
    if (!access.isAdmin && !isClinicOwner(access, facilityId)) {
        return []
    }
    const rows = await db.selectFrom('clinic_memberships')
        .select(['id', 'facility_id', 'invited_email', 'role', 'auth0_sub', 'created_date'])
        .where('facility_id', '=', facilityId)
        .orderBy('role')
        .orderBy('invited_email')
        .execute()
    return rows.map(memberFromRow)
}

export async function inviteClinicMember(
    input: InviteClinicMemberInput,
    access: BookingAccess,
    invitedBy: string | undefined
): Promise<Result<ClinicMember>> {
    const role = roleFromGql(input.role)
    // Owners add staff. Only admins create owners.
    const allowed = access.isAdmin
        || (isClinicOwner(access, input.facilityId) && role === MEMBERSHIP_ROLE.STAFF)
    if (!allowed) {
        return forbidden('facilityId')
    }

    const email = input.email.trim().toLowerCase()
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
        return invalid('email')
    }
    const facility = await db.selectFrom('facilities')
        .select('id')
        .where('id', '=', input.facilityId)
        .executeTakeFirst()
    if (facility === undefined) {
        return invalid('facilityId')
    }

    const site = await db.selectFrom('clinic_sites')
        .select('id')
        .where('facility_id', '=', input.facilityId)
        .executeTakeFirst()

    const existing = await db.selectFrom('clinic_memberships')
        .select(['id', 'role'])
        .where('facility_id', '=', input.facilityId)
        .where('invited_email', '=', email)
        .executeTakeFirst()

    if (existing !== undefined) {
        // An owner may not demote another owner by re-inviting them as staff.
        if (existing.role === MEMBERSHIP_ROLE.OWNER && !access.isAdmin) {
            return forbidden('email')
        }
        const row = await db.updateTable('clinic_memberships')
            .set({ role })
            .where('id', '=', existing.id)
            .returning(['id', 'facility_id', 'invited_email', 'role', 'auth0_sub', 'created_date'])
            .executeTakeFirstOrThrow()
        return { data: memberFromRow(row), hasErrors: false }
    }

    const row = await db.insertInto('clinic_memberships')
        .values({
            facility_id: input.facilityId,
            clinic_site_id: site?.id ?? null,
            user_id: null,
            invited_email: email,
            auth0_sub: null,
            invited_by: invitedBy ?? null,
            claimed_at: null,
            role
        })
        .returning(['id', 'facility_id', 'invited_email', 'role', 'auth0_sub', 'created_date'])
        .executeTakeFirstOrThrow()
    return { data: memberFromRow(row), hasErrors: false }
}

export async function removeClinicMember(id: string, access: BookingAccess): Promise<Result<DeleteResult>> {
    const row = await db.selectFrom('clinic_memberships')
        .select(['id', 'facility_id', 'role'])
        .where('id', '=', id)
        .executeTakeFirst()
    if (row === undefined) {
        return { data: { isSuccessful: false }, hasErrors: false }
    }
    const allowed = access.isAdmin
        || (isClinicOwner(access, row.facility_id) && row.role === MEMBERSHIP_ROLE.STAFF)
    if (!allowed) {
        return forbidden('id')
    }
    const result = await db.deleteFrom('clinic_memberships').where('id', '=', id).executeTakeFirst()
    return { data: { isSuccessful: Number(result.numDeletedRows ?? 0) > 0 }, hasErrors: false }
}

/**
 * Members read the settings. An admin reads them too, to see whether interpretation is on;
 * they hold durations, forms, and languages, never a patient answer.
 */
export async function getBookingSettings(facilityId: string, access: BookingAccess): Promise<BookingSettings | null> {
    if (!canOpenClinic(access, facilityId)) {
        return null
    }
    return bookingSettingsFor(facilityId, access)
}

/** True when the facility's clinic site is on preview, which today is only the showcase clinic. */
async function hasPreviewClinicSite(facilityId: string): Promise<boolean> {
    const site = await db.selectFrom('clinic_sites')
        .select('id')
        .where('facility_id', '=', facilityId)
        .where('status', '=', 'preview')
        .executeTakeFirst()
    return site !== undefined
}

/**
 * Intake forms this user may offer at this clinic. The online consult form stores an
 * address, a backup contact handle, and past illnesses that have no purge path yet
 * (booking-retention.md), so only an admin, or a clinic whose site is still on
 * preview, may turn it on. A form the clinic already offers stays offerable, so an
 * owner can still save or remove it. Lift this once those answers have a retention period.
 */
async function offerableFormIds(facilityId: string, access: BookingAccess): Promise<string[]> {
    const ids = listFormSources().map(source => source.id)
    if (access.isAdmin || await hasPreviewClinicSite(facilityId)) {
        return ids
    }
    const stored = (await settingsForFacility(facilityId)).formDefinitionIds
    return ids.filter(id => id !== SHOWCASE_BOOKING_FORM_ID || stored.includes(id))
}

async function bookingSettingsFor(facilityId: string, access: BookingAccess): Promise<BookingSettings> {
    const [
        settings, interpretation, sms, practitioners, facilityLanguages, interpreters, offerable
    ] = await Promise.all([
        settingsForFacility(facilityId),
        offersInterpretation(facilityId),
        offersSms(facilityId),
        listFacilityPractitioners(facilityId),
        facilityLanguagesFor(facilityId),
        listInterpreters(facilityId),
        offerableFormIds(facilityId, access)
    ])
    return {
        facilityId,
        allowedDurations: settings.allowedDurations,
        defaultDuration: settings.defaultDuration,
        formDefinitionIds: settings.formDefinitionIds,
        offerableFormDefinitionIds: offerable,
        offersInterpretation: interpretation,
        canChangeInterpretation: canChangeInterpretation(access),
        offersSms: sms,
        canChangeSms: canChangeSms(access),
        clinicLanguages: clinicLanguages(practitioners, facilityLanguages, interpreters.map(item => item.languages))
    }
}

/**
 * Turns interpretation on or off for one clinic (#205). Only canChangeInterpretation
 * may, so an owner cannot give their clinic a paid add-on. It does not open booking:
 * that still waits for the clinic's own settings.
 */
export async function setBookingInterpretation(
    input: SetBookingInterpretationInput,
    access: BookingAccess
): Promise<Result<BookingSettings>> {
    if (!canChangeInterpretation(access)) {
        return forbidden('offersInterpretation')
    }
    const facility = await db.selectFrom('facilities')
        .select('id')
        .where('id', '=', input.facilityId)
        .executeTakeFirst()
    if (facility === undefined) {
        return invalid('facilityId')
    }
    await setInterpretation(input.facilityId, input.offersInterpretation)
    return { data: await bookingSettingsFor(input.facilityId, access), hasErrors: false }
}

/**
 * Lets a clinic's patients choose SMS instead of email, or stops it (#206). Only
 * canChangeSms may, so an owner cannot give their clinic a paid add-on. It does not
 * open booking: that still waits for the clinic's own settings.
 */
export async function setBookingSms(
    input: SetBookingSmsInput,
    access: BookingAccess
): Promise<Result<BookingSettings>> {
    if (!canChangeSms(access)) {
        return forbidden('offersSms')
    }
    if (!UUID_REGEX.test(input.facilityId)) {
        return invalid('facilityId')
    }
    try {
        const facility = await db.selectFrom('facilities')
            .select('id')
            .where('id', '=', input.facilityId)
            .executeTakeFirst()
        if (facility === undefined) {
            return invalid('facilityId')
        }
        // setSms is idempotent, so a retry after a failed settings read is safe.
        await setSms(input.facilityId, input.offersSms)
        return { data: await bookingSettingsFor(input.facilityId, access), hasErrors: false }
    } catch (error) {
        logger.error('setBookingSms failed', { facilityId: input.facilityId, ...errorLogFields(error) })
        return {
            data: undefined as never,
            hasErrors: true,
            errors: [{ field: 'offersSms', errorCode: ErrorCode.INTERNAL_SERVER_ERROR, httpStatus: 500 }]
        }
    }
}

export async function updateBookingSettings(
    input: UpdateBookingSettingsInput,
    access: BookingAccess
): Promise<Result<BookingSettings>> {
    if (!isClinicOwner(access, input.facilityId)) {
        return forbidden('facilityId')
    }

    const durations = [...new Set(input.allowedDurations)].sort((a, b) => a - b)
    if (durations.length === 0 || !durations.every(isAppointmentDuration)) {
        return invalid('allowedDurations')
    }
    // An omitted default keeps the rule: 30 minutes when offered, else the shortest.
    const chosenDefault = input.defaultDuration ?? null
    if (chosenDefault !== null && !durations.some(minutes => minutes === chosenDefault)) {
        return invalid('defaultDuration')
    }
    const defaultDuration = resolveDefaultDuration(durations, chosenDefault) ?? durations[0]!
    const formIds = [...new Set(input.formDefinitionIds)]
    if (formIds.length === 0 || !formIds.every(id => formSourceById(id) !== undefined)) {
        return invalid('formDefinitionIds')
    }

    const facility = await db.selectFrom('facilities')
        .select('id')
        .where('id', '=', input.facilityId)
        .executeTakeFirst()
    if (facility === undefined) {
        return invalid('facilityId')
    }
    const offerable = await offerableFormIds(input.facilityId, access)
    if (!formIds.every(id => offerable.includes(id))) {
        return forbidden('formDefinitionIds')
    }
    const site = await db.selectFrom('clinic_sites')
        .select('id')
        .where('facility_id', '=', input.facilityId)
        .executeTakeFirst()

    await db.insertInto('booking_settings')
        .values({
            facility_id: input.facilityId,
            clinic_site_id: site?.id ?? null,
            form_definition_ids: formIds,
            allowed_durations: durations,
            default_duration: chosenDefault
        })
        .onConflict(conflict => conflict.column('facility_id').doUpdateSet({
            form_definition_ids: formIds,
            allowed_durations: durations,
            default_duration: chosenDefault,
            updated_date: sql`now()`
        }))
        .execute()

    const saved = await bookingSettingsFor(input.facilityId, access)
    return { data: { ...saved, defaultDuration }, hasErrors: false }
}
