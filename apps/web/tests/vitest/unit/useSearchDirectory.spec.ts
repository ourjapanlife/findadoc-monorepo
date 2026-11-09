import { setActivePinia, createPinia } from 'pinia'
import { expect } from 'chai'
import { vi, beforeEach, afterEach, describe, it } from 'vitest'
import { createApp, effectScope, nextTick } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { Locale, Specialty, type Facility, type HealthcareProfessional } from '@findadoc/graphql'

const graphQLClientRequestWithRetry = vi.fn()

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    publicReadRequest: () => vi.fn(),
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

const { useSearchDirectory } = await import('~/composables/useSearchDirectory')
const { useSearchResultsStore } = await import('~/stores/searchResultsStore')
const { createAppQueryClient } = await import('~/utils/queryClient')

const TOTAL_FACILITIES = 250
const TARGET_CITY = 'Meguro'
/** Deliberately past the 100-item first page — this is what the pagination bug hid. */
const TARGET_CITY_FIRST_INDEX = 150
const TARGET_CITY_COUNT = 11
/** What the server actually enforces for a full facility page, whatever limit is requested. */
const SERVER_FACILITY_PAGE_CAP = 100

function buildFacility(index: number): Facility {
    const isInTargetCity = index >= TARGET_CITY_FIRST_INDEX
      && index < TARGET_CITY_FIRST_INDEX + TARGET_CITY_COUNT

    return {
        id: `facility-${index}`,
        nameEn: `Clinic ${index}`,
        nameJa: `クリニック${index}`,
        mapLatitude: 35.6,
        mapLongitude: 139.7,
        healthcareProfessionalIds: [`professional-${index}`],
        contact: {
            address: {
                cityEn: isInTargetCity ? TARGET_CITY : `Other City ${index}`,
                cityJa: isInTargetCity ? '目黒' : `他の市${index}`,
                prefectureEn: index % 2 === 0 ? 'Tokyo' : 'Osaka',
                prefectureJa: index % 2 === 0 ? '東京都' : '大阪府',
                postalCode: '000-0000',
                addressLine1En: '1-1-1',
                addressLine2En: '',
                addressLine1Ja: '1-1-1',
                addressLine2Ja: ''
            }
        }
    } as unknown as Facility
}

function buildProfessional(index: number): HealthcareProfessional {
    return {
        id: `professional-${index}`,
        names: [{ firstName: 'Test', middleName: '', lastName: `Doctor ${index}`, locale: 'en_US' }],
        facilityIds: [`facility-${index}`],
        specialties: index % 5 === 0 ? [Specialty.Dentistry] : [Specialty.InternalMedicine],
        spokenLanguages: index % 3 === 0 ? [Locale.EnUs, Locale.JaJp] : [Locale.JaJp],
        degrees: []
    } as unknown as HealthcareProfessional
}

const allFacilities = Array.from({ length: TOTAL_FACILITIES }, (_, index) => buildFacility(index))
const allProfessionals = Array.from({ length: TOTAL_FACILITIES }, (_, index) => buildProfessional(index))

type Variables = { filters?: { limit?: number, offset?: number } }

/** Stands in for the API: honours offset, clamps the facility page like the server does. */
function respondTo(queryDocument: string, variables: Variables) {
    const offset = variables?.filters?.offset ?? 0
    const requestedLimit = variables?.filters?.limit ?? 20

    if (queryDocument.includes('SearchFacilitiesPage')) {
        const limit = Math.min(requestedLimit, SERVER_FACILITY_PAGE_CAP)
        return {
            data: {
                facilities: allFacilities.slice(offset, offset + limit),
                facilitiesTotalCount: TOTAL_FACILITIES
            },
            errors: [],
            hasErrors: false
        }
    }

    if (queryDocument.includes('SearchProfessionalsPage')) {
        return {
            data: {
                healthcareProfessionals: allProfessionals.slice(offset, offset + requestedLimit),
                healthcareProfessionalsTotalCount: TOTAL_FACILITIES
            },
            errors: [],
            hasErrors: false
        }
    }

    throw new Error(`Unexpected query: ${queryDocument}`)
}

function facilityRequestOffsets(): number[] {
    return graphQLClientRequestWithRetry.mock.calls
        .filter(call => String(call[1]).includes('SearchFacilitiesPage'))
        .map(call => (call[2] as { filters: { offset: number } }).filters.offset)
        .sort((a, b) => a - b)
}

type QueryClient = ReturnType<typeof createAppQueryClient>
type Directory = ReturnType<typeof useSearchDirectory>

/** Runs the composable the way a component would: inside an app with the query client installed. */
function mountDirectory(queryClient: QueryClient) {
    const app = createApp({})
    app.use(VueQueryPlugin, { queryClient })
    const scope = effectScope()
    const directory = app.runWithContext(() => scope.run(() => useSearchDirectory()))
    if (!directory) throw new Error('useSearchDirectory did not run')
    return { directory, store: useSearchResultsStore(), unmount: () => scope.stop() }
}

/** Waits until the directory has loaded or failed. */
async function settled(directory: Directory, timeout = 1000) {
    await vi.waitFor(() => {
        if (!directory.isReady.value && !directory.hasLoadError.value) throw new Error('still loading')
    }, { timeout })
}

const failure = (temporary: boolean) =>
    Promise.resolve({ data: {}, errors: [{ message: 'boom', code: 'NETWORK' }], hasErrors: true, temporary })

describe('useSearchDirectory', () => {
    const mounted: (() => void)[] = []
    const mount = (queryClient: QueryClient = createAppQueryClient()) => {
        const result = mountDirectory(queryClient)
        mounted.push(result.unmount)
        return result
    }

    beforeEach(() => {
        setActivePinia(createPinia())
        graphQLClientRequestWithRetry.mockReset()
        graphQLClientRequestWithRetry.mockImplementation(
            (_requestFn: unknown, queryDocument: string, variables: Variables) =>
                Promise.resolve(respondTo(queryDocument, variables))
        )
    })

    afterEach(() => {
        mounted.splice(0).forEach(unmount => unmount())
    })

    describe('loading the directory', () => {
        /*
         * Regression guard for #1807. The old loader decided whether more batches remained by
         * comparing the length of an already city-filtered batch against the batch size, so any
         * city filter stopped pagination after the first 100 facilities. The loader now pages on
         * the server's reported total and the size of what it actually returned.
         */
        it('pages through every facility batch the server caps, not just the first', async () => {
            const { directory } = mount()
            await settled(directory)

            expect(facilityRequestOffsets()).to.deep.equal([0, 100, 200])
            expect(directory.totalResults.value).to.equal(TOTAL_FACILITIES)
        })

        it('sends no bearer token lookup for anonymous search', async () => {
            const { directory } = mount()
            await settled(directory)

            const options = graphQLClientRequestWithRetry.mock.calls.map(call => call[3] as { skipAuth?: boolean })
            expect(options.length).to.be.greaterThan(0)
            options.forEach(option => expect(option?.skipAuth).to.equal(true))
        })

        it('leaves the retry to vue-query, so each page is one attempt per send', async () => {
            const { directory } = mount()
            await settled(directory)

            const options = graphQLClientRequestWithRetry.mock.calls.map(call => call[3] as { retryAmount?: number })
            options.forEach(option => expect(option?.retryAmount).to.equal(0))
        })

        it('shares one load between components and does not reload a fresh directory', async () => {
            const queryClient = createAppQueryClient()
            const first = mount(queryClient)
            const second = mount(queryClient)
            await settled(first.directory)
            await settled(second.directory)
            const callsAfterFirstLoad = graphQLClientRequestWithRetry.mock.calls.length

            const third = mount(queryClient)
            await settled(third.directory)

            // 250 of each at 100 a page: 3 facility pages + 3 professionals pages, fetched once.
            expect(callsAfterFirstLoad).to.equal(6)
            expect(graphQLClientRequestWithRetry.mock.calls.length).to.equal(callsAfterFirstLoad)
            expect(third.directory.totalResults.value).to.equal(TOTAL_FACILITIES)
        })

        /*
         * Regression guard. The professionals endpoint is validated up to limit 1000 but fails
         * somewhere between 300 and 400 rows, returning a 200 with a `Validation Failed` body —
         * so asking for the whole table in one page broke search entirely with nothing to detect
         * and back off from. Never request a page the endpoint cannot serve.
         */
        it('never asks either endpoint for more than 100 rows in one page', async () => {
            const { directory } = mount()
            await settled(directory)

            const limits = graphQLClientRequestWithRetry.mock.calls
                .map(call => (call[2] as { filters?: { limit?: number } }).filters?.limit)
                .filter((limit): limit is number => typeof limit === 'number')

            expect(limits.length).to.be.greaterThan(0)
            limits.forEach(limit => expect(limit).to.be.at.most(100))
        })

        it('pages through every professional, not just the first page', async () => {
            const { directory } = mount()
            await settled(directory)

            const professionalOffsets = graphQLClientRequestWithRetry.mock.calls
                .filter(call => String(call[1]).includes('SearchProfessionalsPage'))
                .map(call => (call[2] as { filters: { offset: number } }).filters.offset)
                .sort((a, b) => a - b)

            expect(professionalOffsets).to.deep.equal([0, 100, 200])
            // Every facility's professional resolves, so nothing is dropped from the join.
            expect(directory.totalResults.value).to.equal(TOTAL_FACILITIES)
        })

        it('shows the skeleton until the directory arrives', () => {
            graphQLClientRequestWithRetry.mockImplementation(() => new Promise(() => {}))
            const { directory } = mount()

            expect(directory.isLoading.value).to.equal(true)
            expect(directory.hasLoadError.value).to.equal(false)
        })

        it('surfaces a failed load as an error state with no results, and does not retry it', async () => {
            graphQLClientRequestWithRetry.mockImplementation(() => failure(false))
            const { directory } = mount()

            await settled(directory)

            expect(directory.hasLoadError.value).to.equal(true)
            expect(directory.isLoading.value).to.equal(false)
            expect(directory.totalResults.value).to.equal(0)
            // The first facility page and the first professionals page, once each.
            expect(graphQLClientRequestWithRetry.mock.calls.length).to.equal(2)
        })

        it('retries a temporary failure once and then shows the results (#219)', async () => {
            graphQLClientRequestWithRetry.mockImplementationOnce(() => failure(true))
            const { directory } = mount()

            await settled(directory, 3000)

            expect(directory.isReady.value).to.equal(true)
            expect(directory.totalResults.value).to.equal(TOTAL_FACILITIES)
        })

        it('can retry after a failed load', async () => {
            graphQLClientRequestWithRetry.mockImplementationOnce(() => failure(false))
            const { directory } = mount()

            await settled(directory)
            expect(directory.hasLoadError.value).to.equal(true)

            await directory.reloadDirectory()

            expect(directory.isReady.value).to.equal(true)
            expect(directory.totalResults.value).to.equal(TOTAL_FACILITIES)
        })

        it('aborts the requests in flight when no component needs the directory any more', async () => {
            graphQLClientRequestWithRetry.mockImplementation(() => new Promise(() => {}))
            const { unmount } = mount()
            await vi.waitFor(() => expect(graphQLClientRequestWithRetry.mock.calls.length).to.be.greaterThan(0))

            unmount()

            const signals = graphQLClientRequestWithRetry.mock.calls
                .map(call => (call[3] as { signal?: AbortSignal }).signal)
            expect(signals.length).to.be.greaterThan(0)
            signals.forEach(signal => expect(signal?.aborted).to.equal(true))
        })
    })

    describe('filtering', () => {
        it('finds facilities in a city that appears only after the first batch', async () => {
            const { directory, store } = mount()
            store.selectedCity = TARGET_CITY

            await settled(directory)

            expect(directory.totalResults.value).to.equal(TARGET_CITY_COUNT)
            directory.searchResultsList.value.forEach(facility => {
                expect(facility.contact?.address?.cityEn).to.equal(TARGET_CITY)
            })
        })

        it('matches on the Japanese city name as well as the English one', async () => {
            const { directory, store } = mount()
            store.selectedCity = '目黒'

            await settled(directory)

            expect(directory.totalResults.value).to.equal(TARGET_CITY_COUNT)
        })

        it('applies filter changes instantly without another request', async () => {
            const { directory, store } = mount()
            await settled(directory)
            const requestCount = graphQLClientRequestWithRetry.mock.calls.length

            store.selectedPrefecture = 'Tokyo'
            expect(directory.totalResults.value).to.equal(TOTAL_FACILITIES / 2)

            store.selectedSpecialties = [Specialty.Dentistry]
            expect(directory.totalResults.value).to.equal(25) // even indices that are multiples of 5 → multiples of 10

            store.selectedLanguages = [Locale.EnUs]
            directory.searchResultsList.value.forEach(facility => {
                facility.healthcareProfessionals.forEach(professional => {
                    expect(professional.spokenLanguages).to.include(Locale.EnUs)
                    expect(professional.specialties).to.include(Specialty.Dentistry)
                })
            })

            expect(graphQLClientRequestWithRetry.mock.calls.length).to.equal(requestCount)
        })

        it('resets to the first page when the filters change', async () => {
            const { directory, store } = mount()
            await settled(directory)

            directory.loadMore()
            expect(directory.paginatedResults.value).to.have.lengthOf(50)

            store.selectedPrefecture = 'Osaka'
            await nextTick()

            expect(directory.paginatedResults.value).to.have.lengthOf(25)
        })

        it('clears every filter at once', async () => {
            const { directory, store } = mount()
            store.selectedCity = TARGET_CITY
            store.selectedSpecialties = [Specialty.Dentistry]
            await settled(directory)

            store.clearFilters()

            expect(directory.totalResults.value).to.equal(TOTAL_FACILITIES)
        })
    })

    describe('active facility', () => {
        it('resolves the active facility from the results', async () => {
            const { directory, store } = mount()
            await settled(directory)

            store.setActiveFacility('facility-3')

            expect(directory.activeFacility.value?.nameEn).to.equal('Clinic 3')
            expect(directory.activeFacility.value?.healthcareProfessionals).to.have.lengthOf(1)
        })

        it('still opens a facility the current filters exclude, showing everyone there', async () => {
            const { directory, store } = mount()
            store.selectedSpecialties = [Specialty.Dentistry]
            await settled(directory)

            store.setActiveFacility('facility-1') // professional-1 is internal medicine

            expect(directory.searchResultsList.value.some(facility => facility.id === 'facility-1')).to.equal(false)
            expect(directory.activeFacility.value?.id).to.equal('facility-1')
            expect(directory.activeFacility.value?.healthcareProfessionals).to.have.lengthOf(1)
        })
    })
})
