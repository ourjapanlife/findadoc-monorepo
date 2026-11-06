import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { main as backfillMapsUrls } from '../utils/backfillCanonicalMapsUrls.js'
import { main as backfillPhones } from '../utils/backfillFacilityPhones.js'
import { main as backfillPlaceIds } from '../utils/backfillFacilityPlaceIds.js'
import { main as backfillInsurance } from '../utils/backfillProfessionalInsurance.js'
import { main as backfillLicenses } from '../utils/backfillProfessionalLicenses.js'

const CA_BUNDLE = fileURLToPath(new URL('../certs/rds-ap-northeast-1-bundle.pem', import.meta.url))
const RDS_HOST = 'findadoc.example.ap-northeast-1.rds.amazonaws.com'

/** The variables `pnpm db:prod` sets for the command it runs. */
function stubProductionTunnel(user: string) {
    vi.stubEnv('FINDADOC_DB_TARGET', 'production')
    vi.stubEnv('PGHOST', RDS_HOST)
    vi.stubEnv('PGHOSTADDR', '127.0.0.1')
    vi.stubEnv('PGPORT', '15432')
    vi.stubEnv('PGUSER', user)
    vi.stubEnv('PGPASSWORD', 'fake-iam-token')
    vi.stubEnv('PGSSLROOTCERT', CA_BUNDLE)
}

// Every backfill that can be imported without running. backfillFacilityCities runs on import,
// and scriptDatabase.test.ts covers the helper it calls.
const BACKFILLS = [
    ['backfill:maps-urls', backfillMapsUrls],
    ['backfill:phones', backfillPhones],
    ['backfill:place-ids', backfillPlaceIds],
    ['backfill:insurance', backfillInsurance],
    ['backfill:licenses', backfillLicenses]
] as const

describe('backfill production guard', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    describe.each(BACKFILLS)('%s', (_name, main) => {
        it('refuses a write as the read-only role before it connects', async () => {
            stubProductionTunnel('findadoc_readonly')
            vi.spyOn(console, 'log').mockImplementation(() => undefined)

            await expect(main(true)).rejects.toThrow('This role can only read')
        })

        it('refuses a production write without --confirm-production', async () => {
            stubProductionTunnel('findadoc_operator')
            vi.spyOn(console, 'log').mockImplementation(() => undefined)

            await expect(main(true)).rejects.toThrow('--confirm-production')
        })

        it('refuses a remote host outside pnpm db:prod', async () => {
            vi.stubEnv('FINDADOC_DB_TARGET', '')
            vi.stubEnv('PGHOST', RDS_HOST)
            vi.spyOn(console, 'log').mockImplementation(() => undefined)

            await expect(main(false)).rejects.toThrow('pnpm db:prod')
        })
    })
})
