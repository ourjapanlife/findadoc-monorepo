import { afterAll, describe, expect, it } from 'vitest'
import { ClinicMemberRole } from '@findadoc/graphql'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import { ANONYMOUS_USER_SUB, Role, type User } from '../src/auth.js'
import { AUTH0_ISSUER } from '../src/accounts/issuers.js'
import { userIdFor } from '../src/accounts/userIdentity.js'
import { bookingAccessFor, type BookingAccess } from '../src/booking/access.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'

const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }
const subjects: string[] = []

function signedIn(sub: string, overrides: Partial<User> = {}): User {
    subjects.push(sub)
    return { sub, name: 'Identity Test', email: '', roles: [Role.User], scope: '', ...overrides }
}

async function emailOf(userId: string): Promise<string | null> {
    const row = await db.selectFrom('user').select('email').where('id', '=', userId).executeTakeFirstOrThrow()
    return row.email
}

describe('userIdFor()', () => {
    afterAll(async () => {
        await db.deleteFrom('clinic_memberships').where('invited_email', '=', 'identity-claim@example.com').execute()
        const identities = await db.selectFrom('user_identities')
            .select('user_id')
            .where('subject', 'in', subjects)
            .execute()
        if (identities.length > 0) {
            await db.deleteFrom('user').where('id', 'in', identities.map(row => row.user_id)).execute()
        }
    })

    it('returns nothing for the anonymous stub', async () => {
        const anonymous: User = { sub: ANONYMOUS_USER_SUB, name: 'Anonymous', email: '', roles: [Role.User], scope: '' }
        expect(await userIdFor(anonymous)).toBeUndefined()
    })

    it('creates one user per identity and returns it again on the next request', async () => {
        const first = await userIdFor(signedIn('auth0|identity-repeat'))
        const again = await userIdFor(signedIn('auth0|identity-repeat'))

        expect(first).toBeDefined()
        expect(again).toBe(first)
    })

    it('treats a token without iss as Auth0', async () => {
        const implicit = await userIdFor(signedIn('auth0|identity-issuer'))
        const explicit = await userIdFor(signedIn('auth0|identity-issuer', { issuer: AUTH0_ISSUER }))

        expect(explicit).toBe(implicit)
    })

    it('gives the same subject from another issuer its own user', async () => {
        const auth0 = await userIdFor(signedIn('shared-subject'))
        const other = await userIdFor(signedIn('shared-subject', { issuer: 'https://accounts.example.com/' }))

        expect(other).toBeDefined()
        expect(other).not.toBe(auth0)
    })

    it('stores only a verified email, lower-cased', async () => {
        const userId = await userIdFor(signedIn('auth0|identity-email', { email: 'Unverified@Example.com' }))
        expect(await emailOf(userId!)).toBeNull()

        await userIdFor(signedIn('auth0|identity-email', { email: 'Verified@Example.com', emailVerified: true }))
        expect(await emailOf(userId!)).toBe('verified@example.com')

        // A later unverified email does not replace it.
        await userIdFor(signedIn('auth0|identity-email', { email: 'other@example.com', emailVerified: false }))
        expect(await emailOf(userId!)).toBe('verified@example.com')
    })

    it('creates one user when the first requests arrive together', async () => {
        const ids = await Promise.all(Array.from({ length: 5 }, () => userIdFor(signedIn('auth0|identity-race'))))

        expect(new Set(ids).size).toBe(1)
        const identities = await db.selectFrom('user_identities')
            .select('user_id')
            .where('subject', '=', 'auth0|identity-race')
            .execute()
        expect(identities).toHaveLength(1)
    })

    it('claims a clinic invite with the user id', async () => {
        const facilityId = sharedFacilityIds[0]!
        const invite = await clinicAccessService.inviteClinicMember(
            { facilityId, email: 'identity-claim@example.com', role: ClinicMemberRole.Staff },
            admin,
            'test|admin'
        )
        expect(invite.hasErrors).toBe(false)
        expect(invite.data.claimed).toBe(false)

        const user = signedIn('auth0|identity-claim', { email: 'identity-claim@example.com', emailVerified: true })
        const access = await bookingAccessFor(user)
        expect(access.memberships.get(facilityId)).toBe('staff')

        const row = await db.selectFrom('clinic_memberships')
            .select(['user_id', 'auth0_sub'])
            .where('id', '=', invite.data.id)
            .executeTakeFirstOrThrow()
        expect(row.user_id).toBe(await userIdFor(user))
        expect(row.auth0_sub).toBeNull()

        const members = await clinicAccessService.listClinicMembers(facilityId, admin)
        expect(members.find(member => member.id === invite.data.id)?.claimed).toBe(true)
    })
})
