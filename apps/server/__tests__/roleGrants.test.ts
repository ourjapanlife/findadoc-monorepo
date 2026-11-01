import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../src/kyselyClient.js'
import { ANONYMOUS_USER_SUB, Role, type User } from '../src/auth.js'
import { userIdFor } from '../src/accounts/userIdentity.js'
import {
    GRANTED_ROLE,
    grantRole,
    grantedRoleFromName,
    revokeRole,
    roleGrantState,
    withGrantedRoles
} from '../src/accounts/roleGrants.js'
import { importGrant, readAuth0Grants } from '../utils/importAuth0Roles.js'

const subjects: string[] = []

function signedIn(sub: string, roles: Role[] = [Role.User], overrides: Partial<User> = {}): User {
    subjects.push(sub)
    return { sub, name: 'Role Test', email: '', roles, scope: '', ...overrides }
}

async function userIdOf(sub: string): Promise<string> {
    const userId = await userIdFor(signedIn(sub))
    if (userId === undefined) {
        throw new Error(`no user for ${sub}`)
    }
    return userId
}

async function auditFor(userId: string): Promise<string[]> {
    const rows = await db.selectFrom('account_audit_log')
        .select('action')
        .where('target_user_id', '=', userId)
        .orderBy('created_date')
        .execute()
    return rows.map(row => row.action)
}

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

afterAll(async () => {
    const identities = await db.selectFrom('user_identities')
        .select('user_id')
        .where('subject', 'in', subjects)
        .execute()
    if (identities.length > 0) {
        await db.deleteFrom('user').where('id', 'in', identities.map(row => row.user_id)).execute()
    }
})

describe('grantedRoleFromName()', () => {
    it('maps the Auth0 role names and skips the rest', () => {
        expect(grantedRoleFromName('Admin')).toBe(GRANTED_ROLE.ADMIN)
        expect(grantedRoleFromName('Moderator')).toBe(GRANTED_ROLE.MODERATOR)
        expect(grantedRoleFromName('Dev')).toBe(GRANTED_ROLE.DEV)
        expect(grantedRoleFromName('User')).toBeUndefined()
        expect(grantedRoleFromName('FacilityOwner')).toBeUndefined()
    })
})

describe('grantRole() and revokeRole()', () => {
    it('grants once, logs it, and revokes it', async () => {
        const userId = await userIdOf('auth0|grant-once')

        expect(await grantRole({ userId, role: GRANTED_ROLE.MODERATOR, actor: 'test' })).toBe('granted')
        expect(await grantRole({ userId, role: GRANTED_ROLE.MODERATOR, actor: 'test' })).toBe('already_granted')
        expect(await revokeRole({ userId, role: GRANTED_ROLE.MODERATOR, actor: 'test' })).toBe('revoked')
        expect(await revokeRole({ userId, role: GRANTED_ROLE.MODERATOR, actor: 'test' })).toBe('not_granted')

        expect(await auditFor(userId)).toEqual(['grant_role', 'revoke_role'])
        const grants = await db.selectFrom('user_role_grants')
            .select(['revoked_by', 'revoked_at'])
            .where('user_id', '=', userId)
            .execute()
        expect(grants).toHaveLength(1)
        expect(grants[0]?.revoked_by).toBe('test')
    })

    it('keeps the last admin', async () => {
        // CI starts from an empty table. A local admin grant would make the second revoke succeed.
        const existing = await db.selectFrom('user_role_grants')
            .select('id')
            .where('role', '=', GRANTED_ROLE.ADMIN)
            .where('revoked_at', 'is', null)
            .execute()
        expect(existing, 'no admin grant before this test').toEqual([])
        const first = await userIdOf('auth0|admin-first')
        const second = await userIdOf('auth0|admin-second')
        await grantRole({ userId: first, role: GRANTED_ROLE.ADMIN, actor: 'test' })
        await grantRole({ userId: second, role: GRANTED_ROLE.ADMIN, actor: 'test' })

        expect(await revokeRole({ userId: first, role: GRANTED_ROLE.ADMIN, actor: 'test' })).toBe('revoked')
        expect(await revokeRole({ userId: second, role: GRANTED_ROLE.ADMIN, actor: 'test' })).toBe('last_admin')
    })
})

describe('withGrantedRoles()', () => {
    it('leaves the anonymous user alone', async () => {
        const anonymous: User = { sub: ANONYMOUS_USER_SUB, name: 'Anonymous', email: '', roles: [Role.User], scope: '' }
        expect(await withGrantedRoles(anonymous)).toBe(anonymous)
    })

    it('keeps the token roles until the first grant exists', async () => {
        vi.spyOn(roleGrantState, 'isRecorded').mockResolvedValue(false)
        const user = await withGrantedRoles(signedIn('auth0|before-import', [Role.User, Role.Admin]))

        expect(user.roles).toEqual([Role.User, Role.Admin])
        expect(user.userId).toBeDefined()
    })

    it('ignores a token role once grants exist, and reads the grant instead', async () => {
        vi.spyOn(roleGrantState, 'isRecorded').mockResolvedValue(true)
        const request = () => signedIn('auth0|after-import', [Role.User, Role.Admin])

        expect((await withGrantedRoles(request())).roles).toEqual([Role.User])

        const userId = await userIdOf('auth0|after-import')
        await grantRole({ userId, role: GRANTED_ROLE.MODERATOR, actor: 'test' })
        expect((await withGrantedRoles(request())).roles).toEqual([Role.User, Role.Moderator])

        await revokeRole({ userId, role: GRANTED_ROLE.MODERATOR, actor: 'test' })
        expect((await withGrantedRoles(request())).roles).toEqual([Role.User])
    })

    it('drops the granted roles when the grants cannot be read', async () => {
        vi.spyOn(roleGrantState, 'isRecorded').mockRejectedValue(new Error('database down'))
        const user = await withGrantedRoles(signedIn('auth0|grants-down', [Role.User, Role.Admin, Role.Dev]))

        expect(user.roles).toEqual([Role.User])
    })
})

describe('Auth0 role import', () => {
    function auth0Stub(responses: Record<string, unknown>) {
        return vi.fn(async (input: string | URL) => {
            const url = new URL(String(input))
            const body = responses[`${url.pathname}${url.search}`] ?? responses[url.pathname]
            if (body === undefined) {
                return new Response('not found', { status: 404 })
            }
            return new Response(JSON.stringify(body), { status: 200 })
        })
    }

    it('reads every Admin, Moderator, and Dev with their verified email', async () => {
        vi.stubGlobal('fetch', auth0Stub({
            '/api/v2/roles': [
                { id: 'rol_admin', name: 'Admin' },
                { id: 'rol_mod', name: 'Moderator' },
                { id: 'rol_editor', name: 'Editor' }
            ],
            '/api/v2/roles/rol_admin/users?per_page=100&page=0': [{ user_id: 'google-oauth2|lead' }],
            '/api/v2/roles/rol_mod/users?per_page=100&page=0': [
                { user_id: 'google-oauth2|lead' },
                { user_id: 'auth0|helper' }
            ],
            '/api/v2/users/google-oauth2%7Clead': { email: 'Lead@Example.com', email_verified: true },
            '/api/v2/users/auth0%7Chelper': { email: 'helper@example.com', email_verified: false }
        }))

        const { rows, skippedRoles } = await readAuth0Grants('token')

        expect(skippedRoles).toEqual(['Editor'])
        expect(rows).toEqual([
            { subject: 'google-oauth2|lead', role: GRANTED_ROLE.ADMIN, email: 'Lead@Example.com' },
            { subject: 'google-oauth2|lead', role: GRANTED_ROLE.MODERATOR, email: 'Lead@Example.com' },
            { subject: 'auth0|helper', role: GRANTED_ROLE.MODERATOR, email: undefined }
        ])
    })

    it('writes a grant on the same user the next sign-in finds, once', async () => {
        subjects.push('google-oauth2|imported')
        const row = { subject: 'google-oauth2|imported', role: GRANTED_ROLE.DEV, email: 'Imported@Example.com' }

        expect(await importGrant(row)).toBe(true)
        expect(await importGrant(row)).toBe(false)

        const userId = await userIdOf('google-oauth2|imported')
        const user = await db.selectFrom('user').select('email').where('id', '=', userId).executeTakeFirstOrThrow()
        expect(user.email).toBe('imported@example.com')
        const grant = await db.selectFrom('user_role_grants')
            .select(['role', 'granted_by'])
            .where('user_id', '=', userId)
            .executeTakeFirstOrThrow()
        expect(grant).toEqual({ role: GRANTED_ROLE.DEV, granted_by: 'auth0-import' })
    })
})
