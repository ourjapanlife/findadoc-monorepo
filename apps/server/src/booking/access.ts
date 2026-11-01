import { sql } from 'kysely'
import { Scope, authorize, type User } from '../auth.js'
import { userIdFor, verifiedEmailFromUser } from '../accounts/userIdentity.js'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'

export { verifiedEmailFromUser }

/**
 * Who may see and change a clinic's bookings.
 *
 * Admins hold the global scopes and reach every clinic while booking is in preview.
 * Moderators manage the directory and get no booking access (src/auth.ts).
 * Everyone else needs a clinic_memberships row for the facility, claimed by their user id.
 * Staff read bookings and edit the calendar. Owners also manage members and
 * booking settings.
 */

export const MEMBERSHIP_ROLE = {
    OWNER: 'owner',
    STAFF: 'staff'
} as const

export type MembershipRole = typeof MEMBERSHIP_ROLE[keyof typeof MEMBERSHIP_ROLE]

export type BookingAccess = {
    readAll: boolean
    writeAll: boolean
    manageMembersAll: boolean
    /** facility id -> role, for claimed memberships only. */
    memberships: Map<string, MembershipRole>
}

export function isMembershipRole(value: string): value is MembershipRole {
    return value === MEMBERSHIP_ROLE.OWNER || value === MEMBERSHIP_ROLE.STAFF
}

/** Attach any pending invite for this verified email to the signed-in user. */
async function claimPendingInvites(user: User, userId: string): Promise<void> {
    const email = verifiedEmailFromUser(user)
    if (email === undefined) {
        return
    }
    try {
        await db.updateTable('clinic_memberships')
            .set({ user_id: userId, claimed_at: sql`now()` })
            .where('invited_email', '=', email)
            .where('user_id', 'is', null)
            .where(({ not, exists, selectFrom }) => not(exists(
                selectFrom('clinic_memberships as other')
                    .select('other.id')
                    .whereRef('other.facility_id', '=', 'clinic_memberships.facility_id')
                    .where('other.user_id', '=', userId)
            )))
            .execute()
    } catch (error) {
        logger.error(`Clinic invite claim failed for ${user.sub}: ${String(error)}`)
    }
}

export async function bookingAccessFor(user: User | null | undefined): Promise<BookingAccess> {
    const access: BookingAccess = {
        readAll: user !== null && user !== undefined && authorize(user, [Scope['read:bookings']]),
        writeAll: user !== null && user !== undefined && authorize(user, [Scope['write:clinic_availability']]),
        manageMembersAll: user !== null && user !== undefined && authorize(user, [Scope['write:clinic_memberships']]),
        memberships: new Map()
    }

    const userId = await userIdFor(user)
    if (user === null || user === undefined || userId === undefined) {
        return access
    }

    await claimPendingInvites(user, userId)

    const rows = await db.selectFrom('clinic_memberships')
        .select(['facility_id', 'role'])
        .where('user_id', '=', userId)
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

export function canReadFacility(access: BookingAccess, facilityId: string | null | undefined): boolean {
    if (access.readAll) {
        return true
    }
    return typeof facilityId === 'string' && access.memberships.has(facilityId)
}

export function canWriteFacility(access: BookingAccess, facilityId: string | null | undefined): boolean {
    if (access.writeAll) {
        return true
    }
    return typeof facilityId === 'string' && access.memberships.has(facilityId)
}

export function isFacilityOwner(access: BookingAccess, facilityId: string | null | undefined): boolean {
    return typeof facilityId === 'string' && access.memberships.get(facilityId) === MEMBERSHIP_ROLE.OWNER
}

/** Settings and members: admins, or the clinic owner. */
export function canManageFacility(access: BookingAccess, facilityId: string | null | undefined): boolean {
    return access.manageMembersAll || isFacilityOwner(access, facilityId)
}

/** Facility ids this user may read, or 'all' for admins. */
export function readableFacilityIds(access: BookingAccess): string[] | 'all' {
    return access.readAll ? 'all' : [...access.memberships.keys()]
}
