import { sql } from 'kysely'
import { Scope, authorize, isAuthenticatedUser, type User } from '../auth.js'
import { db } from '../kyselyClient.js'
import { logger, errorLogFields } from '../logger.js'

/**
 * Who may see and change a clinic's bookings. Two separate things decide it:
 *
 * - Clinic member (owner or staff): a claimed clinic_memberships row for that facility.
 *   Staff read bookings and edit the calendar. The owner also changes settings and staff.
 *   Only members see bookings (#192).
 * - Admin: the write:clinic_memberships scope. An admin sets up clinic accounts (the
 *   clinic list, owners and staff, interpretation) and reads no booking. An admin who
 *   is also a member of a clinic sees that clinic as a member.
 *
 * Moderators manage the directory and get no booking access (src/auth.ts).
 */

export const MEMBERSHIP_ROLE = {
    OWNER: 'owner',
    STAFF: 'staff'
} as const

export type MembershipRole = typeof MEMBERSHIP_ROLE[keyof typeof MEMBERSHIP_ROLE]

export type BookingAccess = {
    /** Admin (write:clinic_memberships): sets up any clinic's account. Reads no booking. */
    isAdmin: boolean
    /** Clinic memberships: facility id -> owner or staff, claimed rows only. */
    memberships: Map<string, MembershipRole>
}

export function isMembershipRole(value: string): value is MembershipRole {
    return value === MEMBERSHIP_ROLE.OWNER || value === MEMBERSHIP_ROLE.STAFF
}

/** Lower-cased email when the token says Auth0 verified it. */
export function verifiedEmailFromUser(user: User | null | undefined): string | undefined {
    if (user === null || user === undefined || user.emailVerified !== true) {
        return undefined
    }
    if (typeof user.email !== 'string') {
        return undefined
    }
    const email = user.email.trim().toLowerCase()
    return email === '' ? undefined : email
}

/** Attach any pending invite for this verified email to the signed-in Auth0 user. */
async function claimPendingInvites(user: User): Promise<void> {
    const email = verifiedEmailFromUser(user)
    if (email === undefined) {
        return
    }
    try {
        await db.updateTable('clinic_memberships')
            .set({ auth0_sub: user.sub, claimed_at: sql`now()` })
            .where('invited_email', '=', email)
            .where('auth0_sub', 'is', null)
            .where(({ not, exists, selectFrom }) => not(exists(
                selectFrom('clinic_memberships as other')
                    .select('other.id')
                    .whereRef('other.facility_id', '=', 'clinic_memberships.facility_id')
                    .where('other.auth0_sub', '=', user.sub)
            )))
            .execute()
    } catch (error) {
        logger.error(`Clinic invite claim failed for ${user.sub}`, errorLogFields(error))
    }
}

export async function bookingAccessFor(user: User | null | undefined): Promise<BookingAccess> {
    const access: BookingAccess = {
        isAdmin: user !== null && user !== undefined && authorize(user, [Scope['write:clinic_memberships']]),
        memberships: new Map()
    }

    if (user === null || user === undefined || !isAuthenticatedUser(user)) {
        return access
    }

    await claimPendingInvites(user)

    const rows = await db.selectFrom('clinic_memberships')
        .select(['facility_id', 'role'])
        .where('auth0_sub', '=', user.sub)
        .where('facility_id', 'is not', null)
        .execute()

    for (const row of rows) {
        if (row.facility_id !== null && isMembershipRole(row.role)) {
            const current = access.memberships.get(row.facility_id)
            if (current !== MEMBERSHIP_ROLE.OWNER) {
                access.memberships.set(row.facility_id, row.role)
            }
        }
    }

    return access
}

/**
 * Clinic member: a claimed owner or staff row for this facility. Only a member reads or
 * changes the clinic's bookings, appointments, uploads, calendar, and settings (#192).
 */
export function isClinicMember(access: BookingAccess, facilityId: string | null | undefined): boolean {
    return typeof facilityId === 'string' && access.memberships.has(facilityId)
}

/** Clinic owner: the member who also changes settings, payment, interpreters, staff, and exports. */
export function isClinicOwner(access: BookingAccess, facilityId: string | null | undefined): boolean {
    return typeof facilityId === 'string' && access.memberships.get(facilityId) === MEMBERSHIP_ROLE.OWNER
}

/** Facility ids where this user is a clinic member. */
export function memberFacilityIds(access: BookingAccess): string[] {
    return [...access.memberships.keys()]
}
