import {
    ClinicMemberRole,
    type BookingClinic,
    type BookingFormType,
    type BookingSettings,
    type ClinicMember,
    type DeleteResult,
    type InviteClinicMemberInput,
    type UpdateBookingSettingsInput
} from '@findadoc/graphql'
import { sql } from 'kysely'
import {
    MEMBERSHIP_ROLE,
    canManageFacility,
    canReadFacility,
    type BookingAccess,
    type MembershipRole
} from '../booking/access.js'
import { formSourceById, listFormSources } from '../booking/formDefinitions.js'
import { APPOINTMENT_STATUS } from '../booking/lifecycle.js'
import { isAppointmentDuration, resolveDefaultDuration } from '../booking/schedule.js'
import { resolveBookingTarget, settingsForFacility } from '../booking/target.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'

/**
 * Clinic booking accounts: who belongs to which facility, and what the clinic
 * offers. Admins invite anyone. An owner invites and removes staff.
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

/** Requested appointments per facility, in one query. A facility with none is absent. */
async function requestedCountsFor(facilityIds: string[]): Promise<Map<string, number>> {
    if (facilityIds.length === 0) {
        return new Map()
    }
    const rows = await db.selectFrom('booking_appointments')
        .select(['facility_id', eb => eb.fn.countAll<string>().as('count')])
        .where('facility_id', 'in', facilityIds)
        .where('status', '=', APPOINTMENT_STATUS.REQUESTED)
        .groupBy('facility_id')
        .execute()
    return new Map(rows
        .filter((row): row is typeof row & { facility_id: string } => row.facility_id !== null)
        .map(row => [row.facility_id, Number(row.count)]))
}

async function bookingClinicFor(
    facilityId: string,
    access: BookingAccess,
    requestedCount: number
): Promise<BookingClinic | null> {
    if (!canReadFacility(access, facilityId)) {
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
        canManage: canManageFacility(access, facilityId),
        requestedCount
    }
}

async function bookingClinicsFor(facilityIds: string[], access: BookingAccess): Promise<BookingClinic[]> {
    const readable = facilityIds.filter(facilityId => canReadFacility(access, facilityId))
    const counts = await requestedCountsFor(readable)
    const clinics = await Promise.all(
        readable.map(facilityId => bookingClinicFor(facilityId, access, counts.get(facilityId) ?? 0))
    )
    return clinics
        .filter((clinic): clinic is BookingClinic => clinic !== null)
        .sort((a, b) => a.clinicName.localeCompare(b.clinicName))
}

export async function getBookingClinic(facilityId: string, access: BookingAccess): Promise<BookingClinic | null> {
    const [clinic] = await bookingClinicsFor([facilityId], access)
    return clinic ?? null
}

/** Clinics this user is a member of. Admins open others by id. */
export async function listMyBookingClinics(access: BookingAccess): Promise<BookingClinic[]> {
    return bookingClinicsFor([...access.memberships.keys()], access)
}

/**
 * Every facility set up for booking: it has booking settings, a clinic member, or a hosted
 * clinic site. Admins only; anyone else gets an empty list.
 */
export async function listAllBookingClinics(access: BookingAccess): Promise<BookingClinic[]> {
    if (!access.readAll) {
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
    if (!canManageFacility(access, facilityId)) {
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
    const allowed = access.manageMembersAll
        || (canManageFacility(access, input.facilityId) && role === MEMBERSHIP_ROLE.STAFF)
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
        if (existing.role === MEMBERSHIP_ROLE.OWNER && !access.manageMembersAll) {
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
    const allowed = access.manageMembersAll
        || (canManageFacility(access, row.facility_id) && row.role === MEMBERSHIP_ROLE.STAFF)
    if (!allowed) {
        return forbidden('id')
    }
    const result = await db.deleteFrom('clinic_memberships').where('id', '=', id).executeTakeFirst()
    return { data: { isSuccessful: Number(result.numDeletedRows ?? 0) > 0 }, hasErrors: false }
}

export async function getBookingSettings(facilityId: string, access: BookingAccess): Promise<BookingSettings | null> {
    if (!canReadFacility(access, facilityId)) {
        return null
    }
    const settings = await settingsForFacility(facilityId)
    return {
        facilityId,
        allowedDurations: settings.allowedDurations,
        defaultDuration: settings.defaultDuration,
        formDefinitionIds: settings.formDefinitionIds
    }
}

export async function updateBookingSettings(
    input: UpdateBookingSettingsInput,
    access: BookingAccess
): Promise<Result<BookingSettings>> {
    if (!canManageFacility(access, input.facilityId)) {
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

    return {
        data: {
            facilityId: input.facilityId,
            allowedDurations: durations,
            defaultDuration,
            formDefinitionIds: formIds
        },
        hasErrors: false
    }
}
