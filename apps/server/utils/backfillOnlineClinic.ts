import pg from 'pg'
import { envVariables } from './environmentVariables.js'
import {
    ONLINE_CLINIC_LANGUAGES,
    ONLINE_CLINIC_NAME_EN,
    ONLINE_CLINIC_NAME_JA,
    TANAKA_NAMES,
    TANAKA_PATIENT_NOTE,
    namesOf,
    planOnlineClinic,
    type NamedFacility,
    type NamedPerson
} from '../src/directory/onlineClinicInsert.js'

/**
 * Insert the multilingual online clinic, link the existing Aya Yumino row, and add Kan Tanaka.
 * Dry-run unless `--write` is passed. Aya's other facility is left in place.
 * The page has no address, so the new facility stays UNVERIFIED_LOCATION.
 */

const write = process.argv.includes('--write')

const BLANK_CONTACT = {
    email: null,
    phone: '',
    website: null,
    googleMapsUrl: '',
    address: {
        postalCode: '',
        prefectureEn: '',
        prefectureJa: '',
        cityEn: '',
        cityJa: '',
        addressLine1En: '',
        addressLine1Ja: '',
        addressLine2En: null,
        addressLine2Ja: null
    }
}

function clientConfig() {
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

async function people(client: pg.Client, locale: string, firstName: string, lastName: string): Promise<NamedPerson[]> {
    const result = await client.query<{ id: string, names: unknown }>(
        `select id, names
         from hps
         where names @> $1::jsonb`,
        [JSON.stringify([{ locale, firstName, lastName }])]
    )
    return result.rows.map(row => ({ id: row.id, names: namesOf(row.names) }))
}

async function main() {
    const client = new pg.Client(clientConfig())
    await client.connect()

    try {
        const aya = await people(client, 'ja_JP', '綾', '弓野')
        const tanaka = await people(client, 'ja_JP', '完', '田中')
        const facilities = await client.query<{ id: string, name_en: string, name_ja: string }>(
            `select id, name_en, name_ja
             from facilities
             where name_ja = $1 or name_en = $2`,
            [ONLINE_CLINIC_NAME_JA, ONLINE_CLINIC_NAME_EN]
        )
        const namedFacilities: NamedFacility[] = facilities.rows.map(row => ({
            id: row.id,
            nameEn: row.name_en,
            nameJa: row.name_ja
        }))
        const links = namedFacilities.length === 1
            ? await client.query<{ hps_id: string, facilities_id: string }>(
                `select hps_id, facilities_id from hps_facilities where facilities_id = $1`,
                [namedFacilities[0].id]
            )
            : { rows: [] }
        const planned = planOnlineClinic({
            aya,
            tanaka,
            facilities: namedFacilities,
            links: links.rows.map(row => ({ hpsId: row.hps_id, facilityId: row.facilities_id }))
        })

        if (!planned.ok) {
            console.error(planned.reason)
            process.exitCode = 1
            return
        }

        console.log(JSON.stringify({ write, ...planned.plan }, null, 2))
        if (!write) {
            return
        }

        await client.query('begin')
        try {
            let facilityId = planned.plan.facilityId
            if (facilityId === null) {
                const inserted = await client.query<{ id: string }>(
                    `insert into facilities (
                        name_en, name_ja, contact, map_latitude, map_longitude,
                        created_date, updated_date, payment_options, city_id,
                        google_place_id, source, verification_status, supported_languages
                     ) values (
                        $1, $2, $3::jsonb, 0, 0,
                        now(), now(), '[]'::jsonb, null,
                        null, 'MANUAL', 'UNVERIFIED_LOCATION', $4::jsonb
                     ) returning id`,
                    [
                        ONLINE_CLINIC_NAME_EN,
                        ONLINE_CLINIC_NAME_JA,
                        JSON.stringify(BLANK_CONTACT),
                        JSON.stringify(ONLINE_CLINIC_LANGUAGES)
                    ]
                )
                const created = inserted.rows[0]
                if (!created) {
                    throw new Error('The clinic facility insert did not return an id')
                }
                facilityId = created.id
            }

            let tanakaId = planned.plan.tanakaId
            if (tanakaId === null) {
                const inserted = await client.query<{ id: string }>(
                    `insert into hps (
                        names, additional_info_for_patients, degrees, specialties,
                        spoken_languages, accepted_insurance, email,
                        created_date, updated_date,
                        primary_license, additional_credentials, license_review, license_recommendation
                     ) values (
                        $1::jsonb, $2, '[]'::jsonb, '[]'::jsonb,
                        '[]'::jsonb, '[]'::jsonb, null,
                        now(), now(),
                        null, '[]'::jsonb, null, null
                     ) returning id`,
                    [JSON.stringify(TANAKA_NAMES), TANAKA_PATIENT_NOTE]
                )
                const created = inserted.rows[0]
                if (!created) {
                    throw new Error('The Tanaka insert did not return an id')
                }
                tanakaId = created.id
            }

            const hpsIds = [
                planned.plan.linkAya ? planned.plan.ayaId : null,
                planned.plan.linkTanaka ? tanakaId : null
            ].filter(id => id !== null)
            for (const hpsId of hpsIds) {
                await client.query(
                    `insert into hps_facilities (hps_id, facilities_id)
                     values ($1, $2)
                     on conflict (hps_id, facilities_id) do nothing`,
                    [hpsId, facilityId]
                )
            }

            await client.query('commit')
            console.log(JSON.stringify({ facilityId, tanakaId, ayaId: planned.plan.ayaId }))
        } catch (error) {
            await client.query('rollback').catch(rollbackError => {
                const message = rollbackError instanceof Error ? rollbackError.message : 'Rollback failed'
                console.error(message)
            })
            throw error
        }
    } finally {
        await client.end()
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Online clinic insert failed')
    process.exit(1)
})
