import pg from 'pg'
import { seedData } from './data.js'

const { Client } = pg

async function runSeed() {
    const client = new Client({
        host: '127.0.0.1',
        port: 54322,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres'
    })

    await client.connect()

    try {
        await client.query('BEGIN')
        await client.query('DELETE FROM "Reservation"')
        await client.query('DELETE FROM "ReservationSlot"')
        await client.query('DELETE FROM affiliation_memberships')
        await client.query('DELETE FROM hps_facilities')
        await client.query('DELETE FROM submissions')
        await client.query('DELETE FROM hps')
        await client.query('DELETE FROM facilities')

        for (const facility of seedData.facilities) {
            const cityId = await lookupCityId(client, facility.city_id)

            if (facility.verification_status === 'CONFIRMED' && !cityId) {
                throw new Error(`No local city row for ${facility.city_id?.prefectureEn}/${facility.city_id?.nameEn}`)
            }

            await client.query(
                `INSERT INTO facilities (
                    id, code, name_en, name_ja, contact, map_latitude, map_longitude,
                    created_date, updated_date, firestore_id, payment_options,
                    city_id, google_place_id, source, verification_status
                ) VALUES (
                    $1, $2, $3, $4, $5::jsonb, $6, $7,
                    $8, $9, $10, $11::jsonb,
                    $12, $13, $14, $15
                )`,
                [
                    facility.id,
                    facility.code,
                    facility.name_en,
                    facility.name_ja,
                    JSON.stringify(facility.contact),
                    facility.map_latitude,
                    facility.map_longitude,
                    facility.created_date,
                    facility.updated_date,
                    facility.firestore_id,
                    JSON.stringify(facility.payment_options),
                    cityId,
                    facility.google_place_id,
                    facility.source,
                    facility.verification_status
                ]
            )
        }

        for (const hp of seedData.hps) {
            await client.query(
                `INSERT INTO hps (
                    id, names, additional_info_for_patients, degrees, primary_license,
                    additional_credentials, license_review, license_recommendation,
                    specialties, spoken_languages, accepted_insurance, email,
                    created_date, updated_date, firestore_id
                ) VALUES (
                    $1, $2::jsonb, $3, $4::jsonb, $5,
                    $6::jsonb, $7, $8,
                    $9::jsonb, $10::jsonb, $11::jsonb, $12,
                    $13, $14, $15
                )`,
                [
                    hp.id,
                    JSON.stringify(hp.names),
                    hp.additional_info_for_patients,
                    JSON.stringify(hp.degrees),
                    hp.primary_license,
                    JSON.stringify(hp.additional_credentials),
                    hp.license_review,
                    hp.license_recommendation,
                    JSON.stringify(hp.specialties),
                    JSON.stringify(hp.spoken_languages),
                    JSON.stringify(hp.accepted_insurance),
                    hp.email,
                    hp.created_date,
                    hp.updated_date,
                    hp.firestore_id
                ]
            )
        }

        for (const relation of seedData.hps_facilities) {
            await client.query(
                'INSERT INTO hps_facilities (hps_id, facilities_id) VALUES ($1, $2)',
                [relation.hps_id, relation.facilities_id]
            )
        }

        for (const submission of seedData.submissions) {
            await client.query(
                `INSERT INTO submissions (
                    id, status, created_date, updated_date, hps_id, facilities_id,
                    google_maps_url, healthcare_professional_name, spoken_languages,
                    notes, facility_partial, healthcare_professionals_partial, firestore_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9::jsonb,
                    $10, $11::jsonb, $12::jsonb, $13
                )`,
                [
                    submission.id,
                    submission.status,
                    submission.created_date,
                    submission.updated_date,
                    submission.hps_id,
                    submission.facilities_id,
                    submission.google_maps_url,
                    submission.healthcare_professional_name,
                    JSON.stringify(submission.spoken_languages),
                    submission.notes,
                    JSON.stringify(submission.facility_partial),
                    JSON.stringify(submission.healthcare_professionals_partial),
                    submission.firestore_id
                ]
            )
        }

        await client.query('COMMIT')

        const count = await client.query('SELECT COUNT(*) FROM facilities')
        console.log(`Seeded ${count.rows[0].count} facilities`)
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error seeding database:', error)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}

async function lookupCityId(
    client: pg.Client,
    city: { prefectureEn: string, nameEn: string } | null
): Promise<string | null> {
    if (!city) {
        return null
    }

    const result = await client.query(
        `SELECT cities.id
         FROM cities
         JOIN prefectures ON prefectures.id = cities.prefecture_id
         WHERE prefectures.name_en = $1 AND cities.name_en = $2`,
        [city.prefectureEn, city.nameEn]
    )

    return result.rows[0]?.id ?? null
}

runSeed()
