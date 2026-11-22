import type { Specialty } from '@findadoc/graphql'
import type { CityOption } from './cityOptions'
import { publicGetRequest } from './graphql'
import type { PrefectureEntry } from './homeDirectory'

/**
 * Which prefectures, cities, and specialties have data, read from the API. The pickers use
 * these instead of a hand-measured list, so a new place or specialty shows up once the
 * directory has it, and an option never leads to an empty search.
 */
export type DirectoryCoverage = {
    prefectures: PrefectureEntry[]
    cities: CityOption[]
    specialties: Specialty[]
}

const COVERAGE_QUERY = `
    query DirectoryCoverage($prefecture: String) {
        availablePrefectures { prefecture { nameEn nameJa } facilityCount }
        availableCities(prefecture: $prefecture) {
            city { id slug nameEn nameJa prefecture { nameEn } }
        }
        availableSpecialties(prefecture: $prefecture) { specialty }
    }
`

type CoverageResponse = {
    data?: {
        availablePrefectures?: Array<{
            prefecture: { nameEn: string, nameJa: string }
            facilityCount: number
        }>
        availableCities?: Array<{
            city: { id: string, slug: string, nameEn: string, nameJa: string, prefecture?: { nameEn?: string } }
        }>
        availableSpecialties?: Array<{ specialty: Specialty }>
    }
    errors?: unknown[]
}

/** Maps the API answer, or returns undefined when it is not a complete answer. */
export function coverageFromResponse(json: CoverageResponse): DirectoryCoverage | undefined {
    const data = json.data
    if (json.errors?.length || !data?.availablePrefectures || !data.availableCities || !data.availableSpecialties) {
        return undefined
    }

    return {
        prefectures: data.availablePrefectures.map(entry => ({
            name: entry.prefecture.nameEn,
            nameJa: entry.prefecture.nameJa,
            approximateFacilities: entry.facilityCount
        })),
        cities: data.availableCities.map(({ city }) => ({
            id: city.id,
            slug: city.slug,
            nameEn: city.nameEn,
            nameJa: city.nameJa,
            prefectureEn: city.prefecture?.nameEn ?? ''
        })),
        specialties: data.availableSpecialties.map(entry => entry.specialty)
    }
}

const cache = new Map<string, Promise<DirectoryCoverage | undefined>>()

/**
 * Coverage for the whole directory, with cities and specialties for one prefecture when given.
 * Resolves undefined when the API cannot answer, so the caller keeps the list it has.
 */
export function fetchDirectoryCoverage(prefecture?: string): Promise<DirectoryCoverage | undefined> {
    const key = prefecture?.trim().toLowerCase() ?? ''
    const cached = cache.get(key)
    if (cached) {
        return cached
    }

    const request = loadCoverage(key)
    cache.set(key, request)
    void request.then(result => {
        if (!result) {
            cache.delete(key)
        }
    })
    return request
}

async function loadCoverage(key: string): Promise<DirectoryCoverage | undefined> {
    try {
        // A cacheable GET with no token, like the directory reads (#242).
        const data = await publicGetRequest<CoverageResponse['data']>({
            document: COVERAGE_QUERY,
            variables: { prefecture: key || null },
            signal: AbortSignal.timeout(10000)
        })
        return coverageFromResponse({ data })
    } catch (error) {
        console.warn('Loading directory coverage failed', error)
        return undefined
    }
}

/**
 * The specialty options to offer: those with a professional, most available first, as the
 * API orders them. The one already selected stays, last, so a shared link still shows its
 * filter. Without coverage, every option in display order.
 */
export function availableSpecialtyOptions<T extends { code: Specialty }>(
    options: readonly T[],
    available: readonly Specialty[] | undefined,
    selected: Specialty | '' | undefined
): T[] {
    if (!available) {
        return [...options]
    }

    const byCode = new Map(options.map(option => [option.code, option]))
    const offered = available
        .map(code => byCode.get(code))
        .filter((option): option is T => option !== undefined)
    const selectedOption = selected ? byCode.get(selected) : undefined
    if (selectedOption && !offered.includes(selectedOption)) {
        offered.push(selectedOption)
    }
    return offered
}
