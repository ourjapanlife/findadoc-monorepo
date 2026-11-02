import pg from 'pg'
import { isLocalHost, localDatabaseConfig } from '../../utils/localDatabase.js'
import { AUTH0_ISSUER } from '../../src/accounts/issuers.js'

/**
 * Makes an Auth0 user a claimed owner of one clinic on the local database. The clinic
 * dashboard Playwright spec runs this for its signed-in test user, the way an invite
 * would after it is claimed. Any host but this machine is refused.
 *
 *   pnpm --filter @findadoc/server e2e:clinic-owner <auth0 sub> <facility id>
 */
const [auth0Sub, facilityId] = process.argv.slice(2)

if (!auth0Sub || !facilityId) {
    console.error('Usage: e2e:clinic-owner <auth0 sub> <facility id>')
    process.exit(1)
}

const database = localDatabaseConfig()

if (!isLocalHost(database.host)) {
    console.error(`e2e:clinic-owner only runs against the local database. PGHOST is ${database.host}.`)
    process.exit(1)
}

const client = new pg.Client(database)

try {
    await client.connect()
    await client.query('BEGIN')
    // The same user the API creates on this sub's first request (src/accounts/userIdentity.ts).
    const identity = await client.query<{ user_id: string }>(
        'SELECT user_id FROM user_identities WHERE issuer = $1 AND subject = $2',
        [AUTH0_ISSUER, auth0Sub]
    )
    let userId = identity.rows[0]?.user_id
    if (userId === undefined) {
        const created = await client.query<{ id: string }>('INSERT INTO "user" DEFAULT VALUES RETURNING id')
        userId = created.rows[0]!.id
        await client.query(
            'INSERT INTO user_identities (user_id, issuer, subject) VALUES ($1, $2, $3)',
            [userId, AUTH0_ISSUER, auth0Sub]
        )
    }
    await client.query(
        `INSERT INTO clinic_memberships (facility_id, user_id, claimed_at, role)
         VALUES ($1, $2, now(), 'owner')
         ON CONFLICT (facility_id, user_id) WHERE facility_id IS NOT NULL AND user_id IS NOT NULL
         DO UPDATE SET role = 'owner', claimed_at = coalesce(clinic_memberships.claimed_at, now())`,
        [facilityId, userId]
    )
    await client.query('COMMIT')
    console.log(`${auth0Sub} owns clinic ${facilityId} on the local database.`)
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
} finally {
    await client.end().catch(() => undefined)
}
