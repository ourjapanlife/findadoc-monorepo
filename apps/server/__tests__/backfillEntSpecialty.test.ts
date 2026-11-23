import { fileURLToPath } from 'node:url'
import pg from 'pg'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as gqlType from '@findadoc/graphql'
import type { gqlMutation } from '../utils/gqlTool.js'
import { backfillEntSpecialty, main, mergedSpecialties } from '../utils/backfillEntSpecialty.js'
import { scriptDatabaseConfig } from '../utils/scriptDatabase.js'
import { generateRandomCreateHealthcareProfessionalInput } from '../src/fakeData/fakeHealthcareProfessionals.js'
import { gqlApiUrl, sharedFacilityIds } from './testSetup.test.js'
import { createHealthcareProfessionalMutation } from './healthcareProfessional.test.js'

const CA_BUNDLE = fileURLToPath(new URL('../certs/rds-ap-northeast-1-bundle.pem', import.meta.url))

describe('mergedSpecialties', () => {
    it('replaces ENT_SPECIALIST with OTOLARYNGOLOGY in place', () => {
        expect(mergedSpecialties([gqlType.Specialty.Dentistry, gqlType.Specialty.EntSpecialist]))
            .toEqual([gqlType.Specialty.Dentistry, gqlType.Specialty.Otolaryngology])
    })

    it('keeps one OTOLARYNGOLOGY when a professional had both', () => {
        expect(mergedSpecialties([gqlType.Specialty.Otolaryngology, gqlType.Specialty.EntSpecialist]))
            .toEqual([gqlType.Specialty.Otolaryngology])
    })
})

describe('backfillEntSpecialty', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('reports in a dry-run, then merges the stored rows on write', async () => {
        const created = await request(gqlApiUrl).post('').send({
            query: createHealthcareProfessionalMutation,
            variables: {
                input: {
                    ...generateRandomCreateHealthcareProfessionalInput(),
                    facilityIds: [sharedFacilityIds[0] ?? ''],
                    specialties: [gqlType.Specialty.EntSpecialist, gqlType.Specialty.Pediatrics]
                }
            }
        } as gqlMutation<gqlType.CreateHealthcareProfessionalInput>)

        expect(created.body.errors).toBeUndefined()
        const id = created.body.data.createHealthcareProfessional.id as string

        const client = new pg.Client(scriptDatabaseConfig())
        await client.connect()
        try {
            const dryRun = await backfillEntSpecialty(client, false)
            expect(dryRun.toMerge).toBeGreaterThanOrEqual(1)
            expect(dryRun.updated).toBe(0)

            const written = await backfillEntSpecialty(client, true)
            expect(written.updated).toBeGreaterThanOrEqual(1)

            const row = await client.query<{ specialties: string[] }>('select specialties from hps where id = $1', [id])
            expect(row.rows[0]?.specialties).toEqual([gqlType.Specialty.Otolaryngology, gqlType.Specialty.Pediatrics])
            expect((await backfillEntSpecialty(client, false)).toMerge).toBe(0)
        } finally {
            await client.end()
        }
    })

    it('refuses a production write without --confirm-production', async () => {
        vi.stubEnv('FINDADOC_DB_TARGET', 'production')
        vi.stubEnv('PGHOST', 'findadoc.example.ap-northeast-1.rds.amazonaws.com')
        vi.stubEnv('PGHOSTADDR', '127.0.0.1')
        vi.stubEnv('PGPORT', '15432')
        vi.stubEnv('PGUSER', 'findadoc_operator')
        vi.stubEnv('PGPASSWORD', 'fake-iam-token')
        vi.stubEnv('PGSSLROOTCERT', CA_BUNDLE)

        await expect(main(['node', 'backfillEntSpecialty.ts', '--write'])).rejects.toThrow(/confirm-production/)
    })
})
