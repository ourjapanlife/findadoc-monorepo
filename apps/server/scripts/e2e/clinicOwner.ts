import pg from 'pg'
import { isLocalHost, localDatabaseConfig } from '../../utils/localDatabase.js'

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
    await client.query(
        `INSERT INTO clinic_memberships (facility_id, auth0_sub, claimed_at, role)
         VALUES ($1, $2, now(), 'owner')
         ON CONFLICT (facility_id, auth0_sub) WHERE facility_id IS NOT NULL AND auth0_sub IS NOT NULL
         DO UPDATE SET role = 'owner', claimed_at = coalesce(clinic_memberships.claimed_at, now())`,
        [facilityId, auth0Sub]
    )
    console.log(`${auth0Sub} owns clinic ${facilityId} on the local database.`)
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
} finally {
    await client.end().catch(() => undefined)
}
