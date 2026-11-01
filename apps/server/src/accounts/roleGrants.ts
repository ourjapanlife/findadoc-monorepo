import { Role, isAuthenticatedUser, type User } from '../auth.js'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'
import { userIdFor } from './userIdentity.js'

/**
 * Admin, Moderator, and Dev come from user_role_grants (#215), read on every request by our
 * user id. A revoke counts on the next request.
 *
 * Until the first grant is written, the token's roles still count, so deploying the table
 * changes nothing. utils/importAuth0Roles.ts copies the Auth0 roles across. From then on a
 * role in the token is ignored. User stays from the token. FacilityOwner and FacilityStaff
 * come from clinic_memberships (src/booking/facilityRoles.ts).
 */

export const GRANTED_ROLE = {
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    DEV: 'dev'
} as const

export type GrantedRole = typeof GRANTED_ROLE[keyof typeof GRANTED_ROLE]

const ROLE_BY_GRANT: Record<GrantedRole, Role> = {
    [GRANTED_ROLE.ADMIN]: Role.Admin,
    [GRANTED_ROLE.MODERATOR]: Role.Moderator,
    [GRANTED_ROLE.DEV]: Role.Dev
}

/** Roles that only a grant gives once grants exist. */
export const GRANTED_ROLES: readonly Role[] = Object.values(ROLE_BY_GRANT)

export function isGrantedRole(value: string): value is GrantedRole {
    return value === GRANTED_ROLE.ADMIN || value === GRANTED_ROLE.MODERATOR || value === GRANTED_ROLE.DEV
}

/** The grant name for an Auth0 role name such as `Admin`, or undefined. */
export function grantedRoleFromName(name: string): GrantedRole | undefined {
    const lower = name.trim().toLowerCase()
    return isGrantedRole(lower) ? lower : undefined
}

let grantsRecorded = false

/** An object so tests can stub it. Once a grant exists, revoked or not, it stays true. */
export const roleGrantState = {
    async isRecorded(): Promise<boolean> {
        if (grantsRecorded) {
            return true
        }
        const row = await db.selectFrom('user_role_grants').select('id').limit(1).executeTakeFirst()
        if (row === undefined) {
            return false
        }
        // It only ever turns true, so a parallel request cannot undo it.
        // eslint-disable-next-line require-atomic-updates
        grantsRecorded = true
        return true
    }
}

export async function activeRolesFor(userId: string): Promise<Role[]> {
    const rows = await db.selectFrom('user_role_grants')
        .select('role')
        .where('user_id', '=', userId)
        .where('revoked_at', 'is', null)
        .execute()
    return rows
        .map(row => row.role)
        .filter(isGrantedRole)
        .map(role => ROLE_BY_GRANT[role])
}

/**
 * The user with our id, and Admin, Moderator, and Dev from their grants.
 * If the read fails, the user keeps no granted role.
 */
export async function withGrantedRoles(user: User): Promise<User> {
    if (!isAuthenticatedUser(user)) {
        return user
    }
    const tokenRoles = (user.roles ?? []).filter(role => !GRANTED_ROLES.includes(role))
    try {
        const userId = await userIdFor(user)
        if (userId === undefined) {
            return user
        }
        if (!(await roleGrantState.isRecorded())) {
            return { ...user, userId }
        }
        const granted = await activeRolesFor(userId)
        return { ...user, userId, roles: [...new Set([...tokenRoles, ...granted])] }
    } catch (error) {
        logger.error(`Role grants could not be read for ${user.sub}: ${String(error)}`)
        return { ...user, roles: tokenRoles }
    }
}

export type GrantResult = 'granted' | 'already_granted'

/** Grants a role and logs it. Granting a role the user already holds changes nothing. */
export async function grantRole(input: { userId: string, role: GrantedRole, actor: string }): Promise<GrantResult> {
    const result = await db.transaction().execute(async trx => {
        const inserted = await trx.insertInto('user_role_grants')
            .values({ user_id: input.userId, role: input.role, granted_by: input.actor })
            .onConflict(conflict => conflict
                .columns(['user_id', 'role'])
                .where('revoked_at', 'is', null)
                .doNothing())
            .returning('id')
            .executeTakeFirst()
        if (inserted === undefined) {
            return 'already_granted' as const
        }
        await trx.insertInto('account_audit_log')
            .values({
                action: 'grant_role',
                actor: input.actor,
                target_user_id: input.userId,
                details: JSON.stringify({ role: input.role, grantId: inserted.id })
            })
            .execute()
        return 'granted' as const
    })
    grantsRecorded = true
    return result
}

export type RevokeResult = 'revoked' | 'not_granted' | 'last_admin'

/** Revokes a role and logs it. The last admin cannot be revoked. */
export async function revokeRole(input: { userId: string, role: GrantedRole, actor: string }): Promise<RevokeResult> {
    return db.transaction().execute(async trx => {
        if (input.role === GRANTED_ROLE.ADMIN) {
            // Lock every active admin grant, so two revokes cannot remove the last two admins.
            const admins = await trx.selectFrom('user_role_grants')
                .select('user_id')
                .where('role', '=', GRANTED_ROLE.ADMIN)
                .where('revoked_at', 'is', null)
                .forUpdate()
                .execute()
            const others = admins.filter(admin => admin.user_id !== input.userId)
            if (others.length === 0 && admins.length > 0) {
                return 'last_admin' as const
            }
        }

        const revoked = await trx.updateTable('user_role_grants')
            .set({ revoked_at: new Date().toISOString(), revoked_by: input.actor })
            .where('user_id', '=', input.userId)
            .where('role', '=', input.role)
            .where('revoked_at', 'is', null)
            .returning('id')
            .executeTakeFirst()
        if (revoked === undefined) {
            return 'not_granted' as const
        }
        await trx.insertInto('account_audit_log')
            .values({
                action: 'revoke_role',
                actor: input.actor,
                target_user_id: input.userId,
                details: JSON.stringify({ role: input.role, grantId: revoked.id })
            })
            .execute()
        return 'revoked' as const
    })
}
