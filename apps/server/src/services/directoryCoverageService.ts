import { sql } from 'kysely'
import { Specialty, type AvailableCity, type AvailablePrefecture, type AvailableSpecialty } from '@findadoc/graphql'
import { db } from '../kyselyClient.js'
import { ErrorCode, type Result } from '../result.js'
import { logger, errorLogFields } from '../logger.js'
import { createLookupCache } from '../lookupCache.js'
import { prefectureTranslations, resolvePrefectureKey } from '../../utils/japanesePrefectures.js'
import { listPrefectures } from './cityService.js'

/**
 * Directory coverage: which prefectures, cities, and specialties have data, and how much.
 * The pickers read these instead of a hand-measured list, so a new place or specialty
 * shows up as soon as a facility or professional has it.
 */

// The directory changes only through moderation, so a container may answer from memory for a
// few minutes. A failed load is not kept.
const COVERAGE_TTL_MS = 5 * 60 * 1000

const prefectureCoverage = createLookupCache<AvailablePrefecture[]>(COVERAGE_TTL_MS)
const cityCoverage = createLookupCache<AvailableCity[]>(COVERAGE_TTL_MS)
const specialtyCoverage = createLookupCache<AvailableSpecialty[]>(COVERAGE_TTL_MS)

const SPECIALTY_VALUES: ReadonlySet<string> = new Set(Object.values(Specialty))

function isSpecialty(value: string): value is Specialty {
    return SPECIALTY_VALUES.has(value)
}

function serverError<T>(field: string): Result<T[]> {
    return {
        data: [],
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.SERVER_ERROR, httpStatus: 500 }]
    }
}

/** Resolves an optional prefecture argument. Blank is no filter; an unknown name is an error. */
function prefectureFilter(prefecture: string | null | undefined): Result<string | undefined> {
    if (!prefecture?.trim()) {
        return { data: undefined, hasErrors: false }
    }

    const key = resolvePrefectureKey(prefecture)
    if (!key) {
        return {
            data: undefined,
            hasErrors: true,
            errors: [{ field: 'prefecture', errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
        }
    }

    return { data: key, hasErrors: false }
}

/** The same address match as the facilities prefecture filter, so the counts agree with search. */
function addressInPrefecture(prefectureKey: string) {
    return sql<boolean>`(facilities.contact->'address'->>'prefectureEn' ilike ${prefectureKey}
        or facilities.contact->'address'->>'prefectureJa' = ${prefectureTranslations[prefectureKey]})`
}

function byCountThenName<T>(count: (item: T) => number, name: (item: T) => string) {
    return (left: T, right: T) => count(right) - count(left) || name(left).localeCompare(name(right))
}

/** Prefectures with at least one addressed facility, most facilities first. */
export function listAvailablePrefectures(): Promise<Result<AvailablePrefecture[]>> {
    return prefectureCoverage.get('all', loadAvailablePrefectures)
}

async function loadAvailablePrefectures(): Promise<Result<AvailablePrefecture[]>> {
    const prefectures = await listPrefectures()
    if (prefectures.hasErrors) {
        return { data: [], hasErrors: true, errors: prefectures.errors }
    }

    try {
        // Grouped by the stored labels, then folded onto the prefecture keys. A row whose
        // labels name no prefecture is not counted, as the prefecture filter would not find it.
        const rows = await db.selectFrom('facilities')
            .select([
                sql<string | null>`facilities.contact->'address'->>'prefectureEn'`.as('prefecture_en'),
                sql<string | null>`facilities.contact->'address'->>'prefectureJa'`.as('prefecture_ja'),
                eb => eb.fn.countAll<string>().as('facility_count')
            ])
            .where('facilities.online', '=', false)
            .groupBy([
                sql`facilities.contact->'address'->>'prefectureEn'`,
                sql`facilities.contact->'address'->>'prefectureJa'`
            ])
            .execute()

        const counts = new Map<string, number>()
        for (const row of rows) {
            const key = resolvePrefectureKey(row.prefecture_en ?? '') ?? resolvePrefectureKey(row.prefecture_ja ?? '')
            if (key) {
                counts.set(key, (counts.get(key) ?? 0) + Number(row.facility_count))
            }
        }

        const data = prefectures.data
            .filter(prefecture => counts.has(prefecture.nameEn))
            .map(prefecture => ({ prefecture, facilityCount: counts.get(prefecture.nameEn) ?? 0 }))
            .sort(byCountThenName(item => item.facilityCount, item => item.prefecture.nameEn))

        return { data, hasErrors: false }
    } catch (error) {
        logger.error('ERROR: listAvailablePrefectures', errorLogFields(error))
        return serverError('availablePrefectures')
    }
}

/** Cities with at least one linked facility, most facilities first, optionally in one prefecture. */
export async function listAvailableCities(prefecture?: string | null): Promise<Result<AvailableCity[]>> {
    const filter = prefectureFilter(prefecture)
    if (filter.hasErrors) {
        return { data: [], hasErrors: true, errors: filter.errors }
    }

    return cityCoverage.get(filter.data ?? '', () => loadAvailableCities(filter.data))
}

async function loadAvailableCities(prefectureKey: string | undefined): Promise<Result<AvailableCity[]>> {
    try {
        let query = db.selectFrom('facilities')
            .innerJoin('cities', 'cities.id', 'facilities.city_id')
            .innerJoin('prefectures', 'prefectures.id', 'cities.prefecture_id')
            .select([
                'cities.id as id',
                'cities.slug as slug',
                'cities.name_en as name_en',
                'cities.name_ja as name_ja',
                'cities.lg_code as lg_code',
                'cities.google_place_id as google_place_id',
                'prefectures.id as prefecture_id',
                'prefectures.slug as prefecture_slug',
                'prefectures.name_en as prefecture_name_en',
                'prefectures.name_ja as prefecture_name_ja',
                eb => eb.fn.countAll<string>().as('facility_count')
            ])
            .where('facilities.online', '=', false)
            .groupBy(['cities.id', 'prefectures.id'])

        if (prefectureKey) {
            query = query.where('prefectures.name_en', '=', prefectureKey)
        }

        const rows = await query.execute()
        const data = rows
            .map(row => ({
                city: {
                    id: row.id,
                    slug: row.slug,
                    nameEn: row.name_en,
                    nameJa: row.name_ja,
                    localGovernmentCode: row.lg_code,
                    googlePlaceId: row.google_place_id,
                    prefecture: {
                        id: row.prefecture_id,
                        slug: row.prefecture_slug,
                        nameEn: row.prefecture_name_en,
                        nameJa: row.prefecture_name_ja
                    }
                },
                facilityCount: Number(row.facility_count)
            }))
            .sort(byCountThenName(item => item.facilityCount, item => item.city.nameEn))

        return { data, hasErrors: false }
    } catch (error) {
        logger.error('ERROR: listAvailableCities', errorLogFields(error))
        return serverError('availableCities')
    }
}

/**
 * Specialties at least one professional practices, most facilities first. With a prefecture,
 * only professionals at a facility there count, and the facility count is that prefecture's.
 */
export async function listAvailableSpecialties(
    prefecture?: string | null
): Promise<Result<AvailableSpecialty[]>> {
    const filter = prefectureFilter(prefecture)
    if (filter.hasErrors) {
        return { data: [], hasErrors: true, errors: filter.errors }
    }

    return specialtyCoverage.get(filter.data ?? '', () => loadAvailableSpecialties(filter.data))
}

async function loadAvailableSpecialties(prefectureKey: string | undefined): Promise<Result<AvailableSpecialty[]>> {
    try {
        let query = db.selectFrom('hps')
            .innerJoin(
                sql<{ value: string }>`jsonb_array_elements_text(hps.specialties)`.as('specialty'),
                join => join.onTrue()
            )
            .leftJoin('hps_facilities', 'hps_facilities.hps_id', 'hps.id')
            .leftJoin('facilities', 'facilities.id', 'hps_facilities.facilities_id')
            .select([
                'specialty.value as specialty',
                sql<string>`count(distinct hps.id)`.as('professional_count'),
                sql<string>`count(distinct facilities.id)`.as('facility_count')
            ])
            .groupBy('specialty.value')

        if (prefectureKey) {
            query = query.where(addressInPrefecture(prefectureKey))
        }

        const rows = await query.execute()
        const data = rows
            .filter((row): row is typeof row & { specialty: Specialty } => isSpecialty(row.specialty))
            .map(row => ({
                specialty: row.specialty,
                professionalCount: Number(row.professional_count),
                facilityCount: Number(row.facility_count)
            }))
            // A picker lists the specialty with the most results first: facilities, as a specialty
            // search returns facilities, then professionals.
            .sort((left, right) => right.facilityCount - left.facilityCount
                || right.professionalCount - left.professionalCount
                || left.specialty.localeCompare(right.specialty))

        return { data, hasErrors: false }
    } catch (error) {
        logger.error('ERROR: listAvailableSpecialties', errorLogFields(error))
        return serverError('availableSpecialties')
    }
}
