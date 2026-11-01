import { isAuthenticatedUser, type User } from '../auth.js'
import { db } from '../kyselyClient.js'
import { AUTH0_ISSUER } from './issuers.js'

/**
 * Our own user id for a signed-in person (#215).
 *
 * A sign-in provider names a person by (issuer, subject). user_identities maps that pair to
 * "user".id, and everything we store about a person (clinic memberships today, role grants
 * next) is keyed by that id, never by the provider's subject. A second provider adds another
 * identity for the same user.
 *
 * "user".email holds the last email the provider marked verified, lower-cased. An unverified
 * email is never written.
 */

/** Lower-cased email when the token says the provider verified it. */
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

function issuerOf(user: User): string {
    return typeof user.issuer === 'string' && user.issuer !== '' ? user.issuer : AUTH0_ISSUER
}

/**
 * The user id for this sign-in. The first request from a new identity creates the user.
 * Returns undefined for the anonymous stub.
 */
export async function userIdFor(user: User | null | undefined): Promise<string | undefined> {
    if (user === null || user === undefined || !isAuthenticatedUser(user)) {
        return undefined
    }
    if (typeof user.userId === 'string') {
        return user.userId
    }
    const issuer = issuerOf(user)
    const email = verifiedEmailFromUser(user) ?? null

    const existing = await db.selectFrom('user_identities as identity')
        .innerJoin('user', 'user.id', 'identity.user_id')
        .select(['identity.user_id', 'user.email'])
        .where('identity.issuer', '=', issuer)
        .where('identity.subject', '=', user.sub)
        .executeTakeFirst()

    if (existing !== undefined) {
        if (email !== null && existing.email !== email) {
            await db.updateTable('user')
                .set({ email, updated_date: new Date().toISOString() })
                .where('id', '=', existing.user_id)
                .execute()
        }
        return existing.user_id
    }

    return db.transaction().execute(async trx => {
        const created = await trx.insertInto('user')
            .values({ email })
            .returning('id')
            .executeTakeFirstOrThrow()
        const linked = await trx.insertInto('user_identities')
            .values({ user_id: created.id, issuer, subject: user.sub })
            .onConflict(conflict => conflict.columns(['issuer', 'subject']).doNothing())
            .returning('user_id')
            .executeTakeFirst()
        if (linked !== undefined) {
            return created.id
        }

        // A parallel request linked this identity first. Use its user.
        await trx.deleteFrom('user').where('id', '=', created.id).execute()
        const winner = await trx.selectFrom('user_identities')
            .select('user_id')
            .where('issuer', '=', issuer)
            .where('subject', '=', user.sub)
            .executeTakeFirstOrThrow()
        return winner.user_id
    })
}
