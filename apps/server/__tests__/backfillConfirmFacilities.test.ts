import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacilitySource, FacilityVerificationStatus } from '@findadoc/graphql'
import { confirmExistingFacilities, main } from '../utils/backfillConfirmFacilities.js'
import { scriptDatabaseConfig } from '../utils/scriptDatabase.js'

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

const CONTACT = JSON.stringify({
    phone: '+81355550100',
    website: 'https://clinic.example.com',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=35.65,139.74',
    address: {
        postalCode: '105-0011',
        prefectureEn: 'Tokyo',
        cityEn: 'Minato',
        addressLine1En: '1-1-1 Shibakoen',
        prefectureJa: '東京都',
        cityJa: '港区',
        addressLine1Ja: '芝公園1-1-1'
    }
})

type FacilityShape = {
    cityId: string | null
    source: FacilitySource | null
    status: FacilityVerificationStatus
}

async function insertFacility(client: pg.ClientBase, shape: FacilityShape): Promise<string> {
    const result = await client.query<{ id: string }>(`
        insert into facilities (
            name_en, name_ja, contact, map_latitude, map_longitude, created_date, updated_date,
            payment_options, city_id, google_place_id, source, verification_status, supported_languages
        )
        values ($1, $2, $3, 35.65, 139.74, now(), now(), '[]', $4, $5, $6, $7, '[]')
        returning id
    `, [
        'Backfill Test Clinic',
        'バックフィルテストクリニック',
        CONTACT,
        shape.cityId,
        `ChIJFakeConfirmBackfill${randomUUID().slice(0, 8)}`,
        shape.source,
        shape.status
    ])
    const id = result.rows[0]?.id
    if (id === undefined) {
        throw new Error('insert returned no id')
    }
    return id
}

async function statusOf(client: pg.ClientBase, id: string): Promise<string | undefined> {
    const result = await client.query<{ verification_status: string }>(
        'select verification_status from facilities where id = $1',
        [id]
    )
    return result.rows[0]?.verification_status
}

describe('backfillConfirmFacilities', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it('confirms hand-entered facilities with a city and leaves imported and unlocated ones alone', async () => {
        const client = new pg.Client(scriptDatabaseConfig())
        await client.connect()
        // Everything runs in one transaction that is rolled back, so the seed stays as it was.
        await client.query('begin')
        try {
            const city = await client.query<{ id: string }>('select id from cities limit 1')
            const cityId = city.rows[0]?.id
            expect(cityId).toBeDefined()
            const withCity = cityId ?? null

            const legacy = await insertFacility(client, {
                cityId: withCity, source: null, status: FacilityVerificationStatus.Unverified
            })
            const manual = await insertFacility(client, {
                cityId: withCity, source: FacilitySource.Manual, status: FacilityVerificationStatus.Unverified
            })
            const imported = await insertFacility(client, {
                cityId: withCity,
                source: FacilitySource.MhlwMultilingualInstitutions,
                status: FacilityVerificationStatus.Unverified
            })
            const unlocated = await insertFacility(client, {
                cityId: null, source: null, status: FacilityVerificationStatus.UnverifiedLocation
            })

            const dryRun = await confirmExistingFacilities(client, false)
            expect(dryRun.toConfirm).toBeGreaterThanOrEqual(2)
            expect(dryRun.imported).toBeGreaterThanOrEqual(1)
            expect(dryRun.updated).toBe(0)
            expect(await statusOf(client, legacy)).toBe(FacilityVerificationStatus.Unverified)

            const written = await confirmExistingFacilities(client, true)
            expect(written.updated).toBe(dryRun.toConfirm)

            expect(await statusOf(client, legacy)).toBe(FacilityVerificationStatus.Confirmed)
            expect(await statusOf(client, manual)).toBe(FacilityVerificationStatus.Confirmed)
            expect(await statusOf(client, imported)).toBe(FacilityVerificationStatus.Unverified)
            expect(await statusOf(client, unlocated)).toBe(FacilityVerificationStatus.UnverifiedLocation)

            const again = await confirmExistingFacilities(client, false)
            expect(again.toConfirm).toBe(0)
        } finally {
            await client.query('rollback')
            await client.end()
        }
    })

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
