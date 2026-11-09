import { gql } from 'graphql-request'
import type { Facility,
    FacilitySearchFilters,
    HealthcareProfessional,
    HealthcareProfessionalSearchFilters } from '@findadoc/graphql'
import { facilitySelection, professionalSelection } from '~/utils/graphqlSelection'
import { requestQueryData } from '~/utils/queryClient'

/**
 * 100 rows a page for both tables.
 *
 * Facilities are clamped to 100 server-side whatever we ask for (findadoc-server
 * `facilityService.searchFacilities`). Professionals are *validated* up to 1000, but the
 * endpoint actually fails somewhere between 300 and 400 rows — measured against
 * api.findadoc.jp, which holds 400 professionals, so a single "give me everything" page could
 * never succeed. It returns a 200 carrying a `Validation Failed` / `INTERNAL_SERVER_ERROR`
 * body rather than a clean limit error, so there is nothing to detect and back off from.
 *
 * 100 is the size the previous implementation used in production, and it is verified here at
 * every offset across the whole table. Do not raise it to the validator's ceiling: that number
 * describes what the input parser accepts, not what the query can serve.
 *
 * Both loaders page on the *count the server reports*, never on the length of a filtered
 * batch — that is how #1807 lost 79% of the directory.
 */
export const FACILITY_PAGE_SIZE = 100
export const PROFESSIONAL_PAGE_SIZE = 100

/** Ceiling on in-flight page requests, so a larger directory cannot become a thundering herd. */
const MAX_CONCURRENT_PAGE_REQUESTS = 6

/**
 * Anonymous reads: no Auth0 wait, and a hard per-attempt deadline so a hung connection
 * surfaces the error state instead of leaving the page on skeletons. vue-query owns the retry.
 */
const PUBLIC_REQUEST_OPTIONS = {
    skipAuth: true,
    abortAfterMs: 10000
}

export interface SearchDirectory {
    facilities: Facility[]
    professionals: HealthcareProfessional[]
}

interface Page<T> {
    rows: T[]
    totalCount: number
}

/**
 * Every published facility and professional, for /search to filter in the browser (#242).
 * The `queryFn` for `queryKeys.searchDirectory()`. A failed page rejects the whole load.
 */
export async function fetchSearchDirectory(signal?: AbortSignal): Promise<SearchDirectory> {
    // Independent tables, so both loads start at once instead of one behind the other.
    const [facilities, professionals] = await Promise.all([
        fetchAllPages(offset => requestFacilitiesPage(offset, signal)),
        fetchAllPages(offset => requestProfessionalsPage(offset, signal))
    ])

    return { facilities, professionals }
}

/**
 * First page tells us the total; the remaining pages are fetched together. The page size
 * is taken from what the server actually returned, so a lower server-side cap still pages
 * correctly rather than silently truncating.
 */
async function fetchAllPages<T>(requestPage: (offset: number) => Promise<Page<T>>): Promise<T[]> {
    const first = await requestPage(0)
    const pageSize = first.rows.length

    if (!pageSize || first.totalCount <= pageSize) {
        return first.rows
    }

    const offsets: number[] = []
    for (let offset = pageSize; offset < first.totalCount; offset += pageSize) {
        offsets.push(offset)
    }

    const rest = await fetchWithLimitedConcurrency(offsets, requestPage)
    return [...first.rows, ...rest.flatMap(page => page.rows)]
}

/**
 * Runs the page requests a few at a time rather than all at once. At today's five pages the
 * difference is nil, but the number of pages grows with the directory and this endpoint has
 * already shown it fails under load rather than degrading.
 */
async function fetchWithLimitedConcurrency<T>(
    offsets: number[],
    requestPage: (offset: number) => Promise<Page<T>>
): Promise<Page<T>[]> {
    const pages: Page<T>[] = new Array(offsets.length)
    let next = 0

    const worker = async () => {
        while (next < offsets.length) {
            const index = next++
            pages[index] = await requestPage(offsets[index]!)
        }
    }

    const workerCount = Math.min(MAX_CONCURRENT_PAGE_REQUESTS, offsets.length)
    await Promise.all(Array.from({ length: workerCount }, worker))

    return pages
}

async function requestFacilitiesPage(offset: number, signal?: AbortSignal): Promise<Page<Facility>> {
    const data = await requestQueryData<{ facilities?: Facility[], facilitiesTotalCount?: number }>(
        searchFacilitiesPageQuery,
        {
            filters: { limit: FACILITY_PAGE_SIZE, offset } satisfies FacilitySearchFilters,
            countFilters: {} satisfies FacilitySearchFilters
        },
        { ...PUBLIC_REQUEST_OPTIONS, signal }
    )

    return {
        rows: data.facilities ?? [],
        totalCount: data.facilitiesTotalCount ?? data.facilities?.length ?? 0
    }
}

async function requestProfessionalsPage(offset: number, signal?: AbortSignal): Promise<Page<HealthcareProfessional>> {
    const data = await requestQueryData<{
        healthcareProfessionals?: HealthcareProfessional[]
        healthcareProfessionalsTotalCount?: number
    }>(
        searchProfessionalsPageQuery,
        {
            filters: { limit: PROFESSIONAL_PAGE_SIZE, offset } satisfies HealthcareProfessionalSearchFilters,
            countFilters: {} satisfies HealthcareProfessionalSearchFilters
        },
        { ...PUBLIC_REQUEST_OPTIONS, signal }
    )

    return {
        rows: data.healthcareProfessionals ?? [],
        totalCount: data.healthcareProfessionalsTotalCount ?? data.healthcareProfessionals?.length ?? 0
    }
}

const searchFacilitiesPageQuery = gql`
    query SearchFacilitiesPage($filters: FacilitySearchFilters!, $countFilters: FacilitySearchFilters!) {
        facilities(filters: $filters) {
            ${facilitySelection}
        }
        facilitiesTotalCount(filters: $countFilters)
    }
`

const searchProfessionalsPageQuery = gql`
    query SearchProfessionalsPage(
        $filters: HealthcareProfessionalSearchFilters!
        $countFilters: HealthcareProfessionalSearchFilters!
    ) {
        healthcareProfessionals(filters: $filters) {
            ${professionalSelection}
        }
        healthcareProfessionalsTotalCount(filters: $countFilters)
    }
`
