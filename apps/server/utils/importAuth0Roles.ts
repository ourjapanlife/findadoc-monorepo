import { pathToFileURL } from 'node:url'
import { envVariables } from './environmentVariables.js'
import { closeDatabase, initializeKyselyClient } from '../src/kyselyClient.js'
import { initializeLogger } from '../src/logger.js'
import { Role } from '../src/auth.js'
import { AUTH0_ISSUER } from '../src/accounts/issuers.js'
import { userIdFor } from '../src/accounts/userIdentity.js'
import { grantRole, grantedRoleFromName, type GrantedRole } from '../src/accounts/roleGrants.js'

/**
 * Copies Admin, Moderator, and Dev from the Auth0 tenant into user_role_grants (#215).
 * Dry-run unless `--write` is passed. Running it again grants nothing twice.
 *
 * Reads the tenant's roles through the Management API, so it needs a machine-to-machine app
 * with read:users and read:roles in AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET.
 * Each user gets our user and Auth0 identity, the same as their next sign-in would create, and
 * their verified email. Other Auth0 roles are listed and skipped.
 *
 * After the first grant is written, the API stops reading these roles from the token.
 */

const AUTH0_API = AUTH0_ISSUER.replace(/\/$/, '')
const PAGE_SIZE = 100
const ACTOR = 'auth0-import'

type Auth0Role = { id: string, name: string }
type Auth0RoleUser = { user_id: string }
type Auth0User = { email?: string, email_verified?: boolean }

export type ImportRow = { subject: string, role: GrantedRole, email: string | undefined }

async function managementToken(): Promise<string> {
    const clientId = envVariables.auth0ManagementClientId()
    const clientSecret = envVariables.auth0ManagementClientSecret()
    if (clientId === undefined || clientId === '' || clientSecret === undefined || clientSecret === '') {
        throw new Error('Set AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET.')
    }
    const response = await fetch(`${AUTH0_API}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            audience: `${AUTH0_API}/api/v2/`
        })
    })
    if (!response.ok) {
        throw new Error(`Auth0 token request failed with ${response.status}.`)
    }
    const body = await response.json() as { access_token?: string }
    if (typeof body.access_token !== 'string') {
        throw new Error('Auth0 returned no access token.')
    }
    return body.access_token
}

async function management<T>(token: string, path: string): Promise<T> {
    const response = await fetch(`${AUTH0_API}/api/v2${path}`, {
        headers: { authorization: `Bearer ${token}` }
    })
    if (!response.ok) {
        throw new Error(`Auth0 GET ${path.split('?')[0]} failed with ${response.status}.`)
    }
    return await response.json() as T
}

async function roleUsers(token: string, roleId: string): Promise<Auth0RoleUser[]> {
    const users: Auth0RoleUser[] = []
    for (let page = 0; ; page += 1) {
        const batch = await management<Auth0RoleUser[]>(
            token,
            `/roles/${encodeURIComponent(roleId)}/users?per_page=${PAGE_SIZE}&page=${page}`
        )
        users.push(...batch)
        if (batch.length < PAGE_SIZE) {
            return users
        }
    }
}

/** Every (Auth0 user, role) pair to import, with the user's verified email. */
export async function readAuth0Grants(token: string): Promise<{ rows: ImportRow[], skippedRoles: string[] }> {
    const roles = await management<Auth0Role[]>(token, '/roles')
    const rows: ImportRow[] = []
    const skippedRoles: string[] = []
    const emails = new Map<string, string | undefined>()

    for (const role of roles) {
        const granted = grantedRoleFromName(role.name)
        if (granted === undefined) {
            skippedRoles.push(role.name)
            continue
        }
        for (const user of await roleUsers(token, role.id)) {
            if (!emails.has(user.user_id)) {
                const profile = await management<Auth0User>(
                    token,
                    `/users/${encodeURIComponent(user.user_id)}?fields=email,email_verified&include_fields=true`
                )
                emails.set(user.user_id, profile.email_verified === true ? profile.email : undefined)
            }
            rows.push({ subject: user.user_id, role: granted, email: emails.get(user.user_id) })
        }
    }
    return { rows, skippedRoles }
}

/** Writes one grant. Returns whether it was new. */
export async function importGrant(row: ImportRow): Promise<boolean> {
    const userId = await userIdFor({
        sub: row.subject,
        issuer: AUTH0_ISSUER,
        name: '',
        email: row.email ?? '',
        emailVerified: row.email !== undefined,
        roles: [Role.User],
        scope: ''
    })
    if (userId === undefined) {
        throw new Error(`No user for ${row.subject}.`)
    }
    return (await grantRole({ userId, role: row.role, actor: ACTOR })) === 'granted'
}

async function main(): Promise<void> {
    const write = process.argv.includes('--write')

    initializeLogger()
    await initializeKyselyClient()

    try {
        const { rows, skippedRoles } = await readAuth0Grants(await managementToken())
        let granted = 0
        for (const row of rows) {
            const label = `${row.role} for ${row.subject} (${row.email ?? 'no verified email'})`
            if (!write) {
                console.log(`would grant ${label}`)
                continue
            }
            const isNew = await importGrant(row)
            granted += isNew ? 1 : 0
            console.log(`${isNew ? 'granted' : 'already granted'} ${label}`)
        }
        console.log(JSON.stringify({ write, grants: rows.length, granted, skippedRoles }, null, 2))
        if (!write && rows.length > 0) {
            console.log('Dry-run only. Re-run with --write to write the grants.')
        }
    } finally {
        await closeDatabase()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        console.error(`importAuth0Roles failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exitCode = 1
    })
}
