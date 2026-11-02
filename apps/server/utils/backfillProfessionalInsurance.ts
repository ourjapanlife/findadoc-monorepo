import pg from 'pg'
import { pathToFileURL } from 'node:url'
import { envVariables } from './environmentVariables.js'
import { poolConfig } from '../src/kyselyClient.js'
import {
    describeStoredInsurance,
    planStoredInsurance,
    reportStoredInsurance,
    type StoredInsuranceRow
} from '../src/insurance/professionalInsurance.js'

/**
 * Clear the old per-professional insurance codes (#18).
 * Dry-run unless `--write` is passed. The dry-run prints each professional with
 * the facility, the city, and the stored codes written as sentences.
 * A write run empties `hps.accepted_insurance`. It never changes a facility's
 * Japanese insurance answer: the migration marked existing clinics yes, and a
 * moderator marks a self-pay-only clinic no. A doctor whose
 * old code said "does not accept insurance" is flagged so that clinic gets checked.
 */

type ProfessionalRow = {
    id: string
    names: { firstName?: string, lastName?: string }[] | null
    accepted_insurance: unknown
    facilities: { name: string, city: string | null, japanese_insurance: string | null }[] | null
}

function clientConfig() {
    // RDS with DB_IAM_AUTH=true signs a token and requires TLS, the same as the API.
    if (envVariables.dbIamAuth()) {
        const { host, port, user, password, ssl, database } = poolConfig()
        if (port === 6543) {
            throw new Error('Use the session database port 5432. The transaction pooler cannot apply this backfill.')
        }
        return { host, port, user, password, ssl, database }
    }

    const password = envVariables.pgPassword()
    const host = envVariables.pgHost() || '127.0.0.1'
    const port = Number(envVariables.pgPort() || (envVariables.isProduction() ? 5432 : 54322))

    if (port === 6543) {
        throw new Error('Use the session database port 5432. The transaction pooler cannot apply this backfill.')
    }

    return {
        host,
        port,
        user: envVariables.pgUser() || 'postgres',
        password: password || 'postgres',
        database: 'postgres'
    }
}

function storedRow(professional: ProfessionalRow): StoredInsuranceRow {
    return {
        acceptedInsurance: professional.accepted_insurance,
        facilities: (professional.facilities ?? []).map(facility => ({
            name: facility.name,
            city: facility.city,
            japaneseInsurance: facility.japanese_insurance
        }))
    }
}

function displayName(professional: ProfessionalRow): string {
    const name = (professional.names ?? [])
        .map(entry => [entry.firstName, entry.lastName].filter(Boolean).join(' '))
        .find(Boolean)

    return name ?? 'Unnamed professional'
}

export async function main(write = process.argv.includes('--write')) {
    const client = new pg.Client(clientConfig())
    await client.connect()

    const counts = { cleared: 0, unchanged: 0 }
    try {
        const professionals = await client.query<ProfessionalRow>(`
            select hps.id,
                   hps.names,
                   hps.accepted_insurance,
                   coalesce(
                       jsonb_agg(
                           jsonb_build_object(
                               'name', coalesce(nullif(facilities.name_en, ''), facilities.name_ja),
                               'city', cities.name_en,
                               'japanese_insurance', facilities.japanese_insurance
                           ) order by facilities.name_en
                       ) filter (where facilities.id is not null),
                       '[]'::jsonb
                   ) as facilities
            from hps
            left join hps_facilities on hps_facilities.hps_id = hps.id
            left join facilities on facilities.id = hps_facilities.facilities_id
            left join cities on cities.id = facilities.city_id
            group by hps.id
            order by hps.updated_date desc
        `)
        const report = reportStoredInsurance(professionals.rows.map(storedRow))

        console.log(JSON.stringify({ write, ...report }, null, 2))

        for (const professional of professionals.rows) {
            const row = storedRow(professional)
            const plan = planStoredInsurance(row)

            if (plan.action === 'keep') {
                counts.unchanged += 1
                continue
            }

            const description = describeStoredInsurance(professional.id, displayName(professional), row, plan)

            if (!write) {
                counts.cleared += 1
                console.log(`would clear ${description}`)
                continue
            }

            const result = await client.query(
                `update hps
                 set accepted_insurance = '[]'::jsonb
                 where id = $1
                   and accepted_insurance <> '[]'::jsonb`,
                [professional.id]
            )
            if ((result.rowCount ?? 0) > 0) {
                counts.cleared += 1
                console.log(`clear ${description}`)
            }
        }
    } finally {
        await client.end()
    }

    console.log(counts)
    return counts
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(error)
        process.exitCode = 1
    })
}
