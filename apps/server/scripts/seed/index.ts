import pg from 'pg'
import { seedData } from './data.js'
import { clinicSiteSeeds, SHOWCASE_CLINIC_SITE_ID, SHOWCASE_FACILITY_ID } from './clinicSiteContent.js'
import type {
    ClinicSiteDoctorInsert,
    ClinicSiteInsert,
    ClinicSiteLanguageInsert,
    ClinicSiteLocaleInsert
} from './schema.js'

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
        await client.query('DELETE FROM booking_appointments')
        await client.query('DELETE FROM booking_uploads')
        await client.query('DELETE FROM booking_submissions')
        await client.query('DELETE FROM clinic_availability_windows')
        await client.query('DELETE FROM booking_settings')
        await client.query('DELETE FROM clinic_memberships')
        await client.query('DELETE FROM clinic_site_locales')
        await client.query('DELETE FROM clinic_site_doctors')
        await client.query('DELETE FROM clinic_site_languages')
        await client.query('DELETE FROM clinic_sites')
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
                    city_id, google_place_id, source, verification_status,
                    supported_languages
                ) VALUES (
                    $1, $2, $3, $4, $5::jsonb, $6, $7,
                    $8, $9, $10, $11::jsonb,
                    $12, $13, $14, $15,
                    $16::jsonb
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
                    facility.verification_status,
                    JSON.stringify(facility.supported_languages)
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

        const seededAt = new Date().toISOString()
        for (const site of clinicSiteSeeds) {
            const siteRow: ClinicSiteInsert = {
                id: site.id,
                facility_id: site.facility_id,
                slug: site.slug,
                status: site.status,
                share_image_path: site.share_image_path,
                hero_path: site.hero_path,
                theme: JSON.stringify(site.theme),
                created_date: seededAt,
                updated_date: seededAt
            }
            await client.query(
                `INSERT INTO clinic_sites (
                    id, facility_id, slug, status, share_image_path, hero_path, theme,
                    created_date, updated_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
                [
                    siteRow.id,
                    siteRow.facility_id,
                    siteRow.slug,
                    siteRow.status,
                    siteRow.share_image_path,
                    siteRow.hero_path,
                    siteRow.theme,
                    siteRow.created_date,
                    siteRow.updated_date
                ]
            )

            for (const [index, language] of site.languages.entries()) {
                const languageRow: ClinicSiteLanguageInsert = {
                    clinic_site_id: site.id,
                    sort_order: index,
                    code: language.code,
                    native_name: language.native,
                    bcp47: language.bcp47
                }
                await client.query(
                    `INSERT INTO clinic_site_languages (
                        clinic_site_id, sort_order, code, native_name, bcp47
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [
                        languageRow.clinic_site_id,
                        languageRow.sort_order,
                        languageRow.code,
                        languageRow.native_name,
                        languageRow.bcp47
                    ]
                )
            }

            for (const [index, doctor] of site.doctors.entries()) {
                const doctorRow: ClinicSiteDoctorInsert = {
                    clinic_site_id: site.id,
                    sort_order: index,
                    name_ja: doctor.nameJa,
                    name_en: doctor.nameEn,
                    image_path: doctor.image,
                    object_position: doctor.position,
                    hp_id: null
                }
                await client.query(
                    `INSERT INTO clinic_site_doctors (
                        clinic_site_id, sort_order, name_ja, name_en, image_path, object_position, hp_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        doctorRow.clinic_site_id,
                        doctorRow.sort_order,
                        doctorRow.name_ja,
                        doctorRow.name_en,
                        doctorRow.image_path,
                        doctorRow.object_position,
                        doctorRow.hp_id
                    ]
                )
            }

            for (const [locale, copy] of Object.entries(site.copy)) {
                const localeRow: ClinicSiteLocaleInsert = {
                    clinic_site_id: site.id,
                    locale,
                    name: copy.name,
                    description: copy.description,
                    document: JSON.stringify(copy)
                }
                await client.query(
                    `INSERT INTO clinic_site_locales (
                        clinic_site_id, locale, name, description, document
                    ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
                    [
                        localeRow.clinic_site_id,
                        localeRow.locale,
                        localeRow.name,
                        localeRow.description,
                        localeRow.document
                    ]
                )
            }
        }

        await client.query(
            `INSERT INTO booking_settings (
                facility_id, clinic_site_id, form_definition_ids, allowed_durations
            ) VALUES ($1, $2, ARRAY['showcase-intake-v1', 'findadoc-intake-v1'], ARRAY[15, 30, 45, 60])`,
            [SHOWCASE_FACILITY_ID, SHOWCASE_CLINIC_SITE_ID]
        )

        // The showcase Book button needs open times. Weekdays 09:00-12:00 and 13:00-17:00 JST.
        for (const window of showcaseAvailabilityWindows(new Date(), 14)) {
            await client.query(
                `INSERT INTO clinic_availability_windows (
                    facility_id, clinic_site_id, starts_at, ends_at, created_by
                ) VALUES ($1, $2, $3, $4, 'seed')`,
                [SHOWCASE_FACILITY_ID, SHOWCASE_CLINIC_SITE_ID, window.startsAt, window.endsAt]
            )
        }

        await client.query('COMMIT')

        const count = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM facilities) AS facilities,
                (SELECT COUNT(*) FROM hps) AS hps,
                (SELECT COUNT(*) FROM submissions) AS submissions,
                (SELECT COUNT(*) FROM clinic_sites) AS clinic_sites
        `)
        const row = count.rows[0]
        console.log(`Seeded ${row.facilities} facilities, ${row.hps} healthcare professionals, ${row.submissions} submissions, and ${row.clinic_sites} clinic sites`)
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error seeding database:', error)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}

const JST_OFFSET_HOURS = 9
const SHOWCASE_HOURS_JST = [[9, 12], [13, 17]] as const

/** Weekday clinic hours (JST) from tomorrow for `days` days, as ISO UTC ranges. */
function showcaseAvailabilityWindows(from: Date, days: number): Array<{ startsAt: string, endsAt: string }> {
    const windows: Array<{ startsAt: string, endsAt: string }> = []
    for (let offset = 1; offset <= days; offset++) {
        const jstDay = new Date(from.getTime() + JST_OFFSET_HOURS * 60 * 60 * 1000)
        jstDay.setUTCDate(jstDay.getUTCDate() + offset)
        const weekday = jstDay.getUTCDay()
        if (weekday === 0 || weekday === 6) {
            continue
        }
        for (const [startHour, endHour] of SHOWCASE_HOURS_JST) {
            const at = (hour: number) => new Date(Date.UTC(
                jstDay.getUTCFullYear(),
                jstDay.getUTCMonth(),
                jstDay.getUTCDate(),
                hour - JST_OFFSET_HOURS
            )).toISOString()
            windows.push({ startsAt: at(startHour), endsAt: at(endHour) })
        }
    }
    return windows
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
