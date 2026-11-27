import enUS from '../../i18n/locales/en.json' with { type: 'json' }
import { test, expect, type Page, type Route } from '@playwright/test'
import { SEARCH_DIRECTORY_SNAPSHOT_PATH, SEARCH_DIRECTORY_SNAPSHOT_VERSION } from '../../utils/searchDirectorySnapshot'
import { graphqlOperation } from './graphqlRequest'

/*
 * The search page is exercised against a mocked API. The production API rejects CORS from
 * localhost and the CI seed data is not stable enough to assert on, so every request to the
 * GraphQL endpoint is answered from the fixture below. This keeps the assertions about the
 * UI rather than about whatever happens to be in the database.
 */

const professionals = [
    {
        id: 'p1',
        names: [{ firstName: 'Aiko', middleName: '', lastName: 'Tanaka', locale: 'en_US' }],
        degrees: ['DDS'],
        specialties: ['DENTISTRY'],
        facilityIds: ['f1'],
        spokenLanguages: ['en_US', 'ja_JP'],
        additionalInfoForPatients: 'Evening appointments available.',
        updatedDate: '2026-08-01T00:00:00.000Z'
    },
    {
        id: 'p2',
        names: [{ firstName: 'Kenji', middleName: '', lastName: 'Sato', locale: 'en_US' }],
        degrees: ['MD'],
        specialties: ['INTERNAL_MEDICINE'],
        facilityIds: ['f1'],
        spokenLanguages: ['ja_JP'],
        additionalInfoForPatients: '',
        updatedDate: '2026-08-01T00:00:00.000Z'
    },
    {
        id: 'p3',
        names: [{ firstName: 'Maria', middleName: '', lastName: 'Lopez', locale: 'en_US' }],
        degrees: ['DDS'],
        specialties: ['DENTISTRY'],
        facilityIds: ['f2'],
        spokenLanguages: ['en_US', 'es_ES'],
        additionalInfoForPatients: '',
        updatedDate: '2026-08-01T00:00:00.000Z'
    },
    {
        id: 'p4',
        names: [{ firstName: 'Yuki', middleName: '', lastName: 'Mori', locale: 'en_US' }],
        degrees: ['MD'],
        specialties: ['DERMATOLOGY'],
        facilityIds: ['f3'],
        spokenLanguages: ['ja_JP', 'fr_FR'],
        additionalInfoForPatients: '',
        updatedDate: '2026-08-01T00:00:00.000Z'
    }
]

function facility(
    id: string,
    nameEn: string,
    professionalIds: string[],
    cityEn: string,
    prefectureEn: string,
    pin: { latitude: number, longitude: number }
) {
    return {
        id,
        nameEn,
        nameJa: `${nameEn} JA`,
        mapLatitude: pin.latitude,
        mapLongitude: pin.longitude,
        healthcareProfessionalIds: professionalIds,
        contact: {
            address: {
                addressLine1En: '1-2-3 Example',
                addressLine2En: '',
                addressLine1Ja: '1-2-3',
                addressLine2Ja: '',
                cityJa: cityEn,
                cityEn,
                prefectureJa: prefectureEn,
                prefectureEn,
                postalCode: '100-0001'
            },
            email: 'none',
            googleMapsUrl: 'https://maps.app.goo.gl/example',
            phone: '03-1234-5678',
            website: 'https://example.com'
        },
        updatedDate: '2026-08-01T00:00:00.000Z'
    }
}

// Fake pins in each city, far enough apart that distance order is unambiguous.
const SHIBUYA_PIN = { latitude: 35.658, longitude: 139.7016 }
const OSAKA_PIN = { latitude: 34.7055, longitude: 135.4983 }
const SAPPORO_PIN = { latitude: 43.0618, longitude: 141.3545 }

const facilities = [
    facility('f1', 'Tokyo Family Clinic', ['p1', 'p2'], 'Shibuya', 'Tokyo', SHIBUYA_PIN),
    facility('f2', 'Osaka Dental', ['p3'], 'Kita', 'Osaka', OSAKA_PIN),
    // Imported from the Ministry of Health list (#21), so its details credit the ministry.
    {
        ...facility('f3', 'Sapporo Skin Clinic', ['p4'], 'Chuo', 'Hokkaido', SAPPORO_PIN),
        source: 'MHLW_MULTILINGUAL_INSTITUTIONS'
    }
]

/** Somewhere in Kyoto: Osaka is nearest, then Tokyo, then Sapporo. */
const VISITOR_IN_KYOTO = { latitude: 35.0116, longitude: 135.7681 }

type LocationStub = {
    /** What `navigator.permissions.query` reports before anything is asked. */
    permission: PermissionState
    /** The answer to `getCurrentPosition`: a position, or a refusal. */
    answer: { latitude: number, longitude: number } | 'denied'
}

/**
 * Replaces the browser's location and permission APIs, so the same test runs in every engine
 * and counts how often the page asks. `window.findadocLocationRequests` is that count.
 */
async function stubLocation(page: Page, stub: LocationStub) {
    await page.addInitScript((options: LocationStub) => {
        const counter = window as unknown as { findadocLocationRequests: number }
        counter.findadocLocationRequests = 0
        const geolocation = {
            getCurrentPosition(
                success: (position: { coords: { latitude: number, longitude: number } }) => void,
                failure: (error: { code: number, PERMISSION_DENIED: number }) => void
            ) {
                counter.findadocLocationRequests++
                setTimeout(() => {
                    if (options.answer === 'denied') {
                        failure({ code: 1, PERMISSION_DENIED: 1 })
                    } else {
                        success({ coords: options.answer })
                    }
                }, 50)
            }
        }
        Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true })
        const originalQuery = navigator.permissions?.query?.bind(navigator.permissions)
        Object.defineProperty(navigator, 'permissions', {
            configurable: true,
            value: {
                query: (descriptor: { name: string }) => descriptor.name === 'geolocation'
                    ? Promise.resolve({ state: options.permission, addEventListener: () => undefined })
                    : originalQuery?.(descriptor as PermissionDescriptor)
            }
        })
    }, stub)
}

async function locationRequests(page: Page): Promise<number> {
    return page.evaluate(() => (window as unknown as { findadocLocationRequests: number }).findadocLocationRequests)
}

function cardNames(page: Page) {
    return page.getByTestId('search-result-card').locator('h3')
}

function isApiRequest(url: URL): boolean {
    return (url.hostname === '127.0.0.1' && url.port === '4000') || url.hostname === 'api.findadoc.jp'
}

/**
 * The largest page the real API can actually serve.
 *
 * Facilities are clamped to 100 server-side; professionals are *validated* up to 1000 but the
 * endpoint fails somewhere between 300 and 400 rows, returning a 200 whose body is a
 * `Validation Failed` error. Asking for the whole table in one page therefore broke search in
 * production while every test here passed, because this mock answered anything it was asked.
 * It now refuses an oversized page the same way the real server does, so the suite fails if the
 * client ever asks for more than the API can give.
 */
const MAX_SERVABLE_PAGE = 100

/**
 * The build's directory snapshot (#242). A generated site serves the seeded directory there,
 * which would paint before this file's mock answers. Each test gets no snapshot unless it
 * passes one, so the assertions stay about the mocked API.
 */
async function mockSnapshot(page: Page, snapshot?: unknown) {
    await page.route(`**${SEARCH_DIRECTORY_SNAPSHOT_PATH}`, async (route: Route) => {
        if (snapshot === undefined) {
            await route.fulfill({ status: 404, body: '' })
            return
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) })
    })
}

function requestedLimit(variables: Record<string, unknown> | undefined): number | undefined {
    const filters = variables?.filters
    if (filters === null || typeof filters !== 'object' || !('limit' in filters)) {
        return undefined
    }
    return typeof filters.limit === 'number' ? filters.limit : undefined
}

async function mockApi(page: Page, options: { fail?: boolean } = {}) {
    await page.route(isApiRequest, async (route: Route) => {
        if (options.fail) {
            await route.fulfill({ status: 500, contentType: 'application/json', body: '{"errors":[{"message":"down"}]}' })
            return
        }

        const body = graphqlOperation(route.request())
        const query = body?.query ?? ''
        const limit = requestedLimit(body?.variables)

        if (limit !== undefined && limit > MAX_SERVABLE_PAGE) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: null,
                    errors: [{ message: 'Validation Failed', extensions: { code: 'BAD_USER_INPUT' } }]
                })
            })
            return
        }

        if (query.includes('SearchFacilitiesPage')) {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ data: { facilities, facilitiesTotalCount: facilities.length } })
            })
            return
        }

        if (query.includes('SearchProfessionalsPage')) {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    data: { healthcareProfessionals: professionals, healthcareProfessionalsTotalCount: professionals.length }
                })
            })
            return
        }

        await route.fulfill({ contentType: 'application/json', body: '{"data":{}}' })
    })
}

test.describe('Search page', () => {
    /** Requests to Google's Maps SDK, so the tests can assert it is never fetched for the list. */
    let mapsRequests: string[] = []

    test.beforeEach(async ({ page }) => {
        mapsRequests = []
        page.on('request', request => {
            if (request.url().includes('maps.googleapis.com')) {
                mapsRequests.push(request.url())
            }
        })
        await mockSnapshot(page)
        await mockApi(page)
    })

    test.describe('Landscape mode', () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 1728, height: 1077 })
        })

        test('lists results first and loads no map until asked', async ({ page }) => {
            await page.goto('/search')

            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
            await expect(page.getByTestId('search-result-count')).toHaveText('3 results found')
            await expect(page.getByTestId('search-map-panel')).toHaveCount(0)
            expect(mapsRequests).toEqual([])
        })

        /*
         * Asserts our lazy-load boundary, not Google's rendered map: the SDK is fetched from
         * the network and there is no API key in CI, so whether it finishes painting is not
         * deterministic. What this suite owns is that the panel mounts only once asked and
         * that the SDK is requested only then.
         */
        test('shows the map on demand, and only requests the SDK then', async ({ page }) => {
            await page.goto('/search')
            await expect(page.getByTestId('search-result-card').first()).toBeVisible()
            expect(mapsRequests).toEqual([])

            await page.getByTestId('search-map-toggle').click()

            await expect(page.getByTestId('search-map-panel')).toBeVisible()
            await expect.poll(() => mapsRequests.length).toBeGreaterThan(0)
        })

        test('loads the directory with cacheable GETs that carry no token (#242)', async ({ page }) => {
            const apiCalls: { method: string, authorization: string | undefined }[] = []
            page.on('request', request => {
                if (isApiRequest(new URL(request.url()))) {
                    apiCalls.push({ method: request.method(), authorization: request.headers().authorization })
                }
            })

            await page.goto('/search')
            await expect(page.getByTestId('search-result-card')).toHaveCount(3)

            expect(apiCalls.length).toBeGreaterThan(0)
            apiCalls.forEach(call => {
                expect(call.method).toBe('GET')
                expect(call.authorization).toBeUndefined()
            })
        })

        test('shows the top nav and footer', async ({ page }) => {
            await page.goto('/search')

            await expect(page.getByTestId('top-nav')).toBeVisible()
            await expect(page.getByTestId('footer')).toBeVisible()
        })

        test('applies specialty, language and prefecture from the URL and reflects them in the controls', async ({ page }) => {
            await page.goto('/search?specialty=dentistry&language=en&prefecture=tokyo')

            await expect(page.getByTestId('search-specialty')).toHaveValue('DENTISTRY')
            await expect(page.getByTestId('search-language')).toHaveValue('en_US')
            await expect(page.getByTestId('search-area')).toHaveValue('tokyo')
            await expect(page.getByTestId('search-result-card')).toHaveCount(1)
            await expect(page.getByRole('link', { name: 'Tokyo Family Clinic' })).toBeVisible()
        })

        test('collapses the filters to a one-line summary and opens them again', async ({ page }) => {
            await page.goto('/search?specialty=dentistry&language=en&prefecture=tokyo')

            const toggle = page.getByTestId('search-filters-toggle')
            const filters = page.getByTestId('search-filters')
            const summary = page.getByTestId('search-filter-summary')
            await expect(filters).toBeVisible()
            await expect(toggle).toHaveAttribute('aria-expanded', 'true')
            await expect(summary).toBeHidden()

            await toggle.click()

            await expect(filters).toBeHidden()
            await expect(toggle).toHaveAttribute('aria-expanded', 'false')
            await expect(summary).toHaveText(`${enUS.specialties.dentistry} · English · Tokyo`)
            await expect(page.getByTestId('search-result-card')).toHaveCount(1)

            await toggle.click()

            await expect(filters).toBeVisible()
            await expect(summary).toBeHidden()
        })

        test('names the region in the summary when no prefecture is picked', async ({ page }) => {
            await page.goto('/search?language=en&region=kanto')

            await expect(page.getByTestId('search-filters-toggle')).toHaveAttribute('aria-expanded', 'true')
            await page.getByTestId('search-filters-toggle').click()

            await expect(page.getByTestId('search-filter-summary')).toHaveText(`English · ${enUS.regions.kanto}`)
        })

        test('offers the prefectures and specialties the directory has (#21)', async ({ page }) => {
            await page.route(isApiRequest, async (route: Route) => {
                if (!graphqlOperation(route.request())?.query?.includes('DirectoryCoverage')) {
                    await route.fallback()
                    return
                }
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: {
                            availablePrefectures: [
                                { prefecture: { nameEn: 'Hiroshima', nameJa: '広島県' }, facilityCount: 24 }
                            ],
                            availableCities: [],
                            availableSpecialties: [{ specialty: 'DENTISTRY' }]
                        }
                    })
                })
            })
            await page.goto('/search')

            await expect(page.getByTestId('search-area').locator('option[value="hiroshima"]'))
                .toHaveText('Hiroshima (24)')
            // Only groups with a practiced specialty are offered, then only that group's specialties (#277).
            const group = page.getByTestId('search-specialty-group')
            await expect(group.locator('option[value="DENTAL"]')).toHaveCount(1)
            await expect(group.locator('option[value="DERMATOLOGY"]')).toHaveCount(0)
            await expect(page.getByTestId('search-specialty')).toBeDisabled()
            await group.selectOption('DENTAL')
            await expect(page.getByTestId('search-specialty').locator('option[value="DENTISTRY"]')).toHaveCount(1)
            await expect(page.getByTestId('search-specialty').locator('option[value="ORTHODONTICS"]')).toHaveCount(0)
        })

        test('searches a whole region, then narrows to a prefecture inside it', async ({ page }) => {
            await page.goto('/search')
            await page.getByTestId('search-region').selectOption('KANTO')

            await expect(page).toHaveURL(/region=kanto/)
            await expect(page.getByTestId('search-result-card')).toHaveCount(1)
            await expect(page.getByRole('link', { name: 'Tokyo Family Clinic' })).toBeVisible()
            // Only that region's prefectures are offered.
            const prefecture = page.getByTestId('search-area')
            await expect(prefecture.locator('option[value="tokyo"]')).toHaveCount(1)
            await expect(prefecture.locator('option[value="osaka"]')).toHaveCount(0)

            await prefecture.selectOption('tokyo')
            await expect(page).toHaveURL(/prefecture=tokyo/)
            await expect(page.getByTestId('search-city')).toBeEnabled()
        })

        test('shows the region of a prefecture-only link', async ({ page }) => {
            await page.goto('/search?prefecture=osaka')

            await expect(page.getByTestId('search-region')).toHaveValue('KANSAI')
            await expect(page.getByTestId('search-result-card')).toHaveCount(1)
            await expect(page.getByRole('link', { name: 'Osaka Dental' })).toBeVisible()
        })

        test('updates the URL and the results as soon as a filter changes', async ({ page }) => {
            await page.goto('/search')
            await page.getByTestId('search-specialty-group').selectOption('DERMATOLOGY')
            await page.getByTestId('search-specialty').selectOption('DERMATOLOGY')

            await expect(page).toHaveURL(/specialty=dermatology/)
            await expect(page.getByTestId('search-result-card')).toHaveCount(1)
            await expect(page.getByRole('link', { name: 'Sapporo Skin Clinic' })).toBeVisible()

            await page.getByTestId('search-clear-filters').click()

            await expect(page).not.toHaveURL(/specialty=/)
            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
        })

        test('a specialty group alone finds every specialty in it, and stays in the URL (#277)', async ({ page }) => {
            await page.goto('/search?group=dental')

            await expect(page.getByTestId('search-specialty-group')).toHaveValue('DENTAL')
            await expect(page.getByTestId('search-specialty')).toBeEnabled()
            await expect(page.getByRole('link', { name: 'Tokyo Family Clinic' })).toBeVisible()
            await expect(page.getByRole('link', { name: 'Sapporo Skin Clinic' })).toHaveCount(0)
        })

        test('browser back restores the previous filter state', async ({ page }) => {
            await page.goto('/search')
            await page.getByTestId('search-specialty-group').selectOption('DENTAL')
            await page.getByTestId('search-specialty').selectOption('DENTISTRY')
            await expect(page).toHaveURL(/specialty=dentistry/)

            await page.getByTestId('search-specialty').selectOption('ORTHODONTICS')
            await expect(page).toHaveURL(/specialty=orthodontics/)

            await page.goBack()

            await expect(page).toHaveURL(/specialty=dentistry/)
            await expect(page.getByTestId('search-specialty')).toHaveValue('DENTISTRY')
            await expect(page.getByRole('link', { name: 'Tokyo Family Clinic' })).toBeVisible()
        })

        test('filtered search URLs are noindex so they do not compete with facet pages', async ({ page }) => {
            await page.goto('/search')
            await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0)
            // Wait for hydration: its router.replace otherwise interrupts the next goto (WebKit flake).
            await expect(page.getByTestId('search-result-card')).toHaveCount(3)

            await page.goto('/search?specialty=dentistry')
            await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1)
        })

        test('still restores filters from GraphQL enum query params', async ({ page }) => {
            await page.goto('/search?specialty=DENTISTRY&language=en_US&prefecture=Tokyo')

            await expect(page.getByTestId('search-specialty')).toHaveValue('DENTISTRY')
            await expect(page.getByTestId('search-result-card')).toHaveCount(1)
            await expect(page).toHaveURL(/specialty=dentistry/)
            await expect(page).toHaveURL(/language=en/)
            await expect(page).toHaveURL(/prefecture=tokyo/)
        })

        test('ignores a specialty that is not a real enum value', async ({ page }) => {
            await page.goto('/search?specialty=NOT_A_SPECIALTY')

            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
        })

        test('search result cards link to clinic pages, and staff names to doctor pages', async ({ page }) => {
            await page.goto('/search')

            await expect(page.getByRole('link', { name: 'Tokyo Family Clinic' }))
                .toHaveAttribute('href', '/clinic/tokyo/shibuya/tokyo-family-clinic--f1')
            await expect(page.getByRole('link', { name: 'Osaka Dental' }))
                .toHaveAttribute('href', '/clinic/osaka/kita/osaka-dental--f2')
            await expect(page.getByRole('link', { name: 'Aiko Tanaka' }))
                .toHaveAttribute('href', '/doctor/aiko-tanaka--p1')
            await expect(page.getByRole('link', { name: 'Maria Lopez' }))
                .toHaveAttribute('href', '/doctor/maria-lopez--p3')
        })

        /*
         * Map pins keep the visitor on /search (`?facility=`). Leaving for the clinic
         * page from a marker dropped the results list and the map on Back.
         */
        test('a shared ?facility= link still opens the details panel', async ({ page }) => {
            await page.goto('/search?facility=f3')

            const panel = page.getByTestId('search-details-panel')
            await expect(panel.getByRole('heading', { name: 'Sapporo Skin Clinic' })).toBeVisible()
            await expect(panel.getByRole('link', { name: 'Yuki Mori' }))
                .toHaveAttribute('href', '/doctor/yuki-mori--p4')
            await expect(page).toHaveURL(/facility=f3/)
        })

        test('credits the Ministry of Health on a facility imported from its data (#21)', async ({ page }) => {
            await page.goto('/search?facility=f3')

            const credit = page.getByTestId('search-details-panel').getByTestId('facility-source-credit')
            await expect(credit).toBeVisible()
            await expect(credit.getByRole('link', { name: 'Medical Information Net open data' }))
                .toHaveAttribute('href', /mhlw\.go\.jp/)
            await expect(credit.getByRole('link').first()).toHaveAttribute('rel', 'noopener noreferrer')
            const pinCredit = page.getByTestId('search-details-panel').getByTestId('facility-pin-credit')
            await expect(pinCredit.getByRole('link', { name: 'Geospatial Information Authority of Japan address search' }))
                .toHaveAttribute('href', /gsi\.go\.jp/)

            await page.goto('/search?facility=f1')
            await expect(page.getByTestId('search-details-panel').getByRole('heading', { name: 'Tokyo Family Clinic' }))
                .toBeVisible()
            await expect(page.getByTestId('facility-source-credit')).toHaveCount(0)
            await expect(page.getByTestId('facility-pin-credit')).toHaveCount(0)
        })

        test('the back-to-results button closes a panel opened from a shared link', async ({ page }) => {
            await page.goto('/search?facility=f2')
            await expect(page.getByTestId('search-details-panel')).toBeVisible()

            await page.getByTestId('search-details-close').click()

            await expect(page.getByTestId('search-details-panel')).toBeHidden()
            await expect(page).not.toHaveURL(/facility=/)
        })

        /*
         * Regression guard: closing used to go Back whenever the previous entry was any /search
         * URL, so opening a second facility and closing it reopened the first.
         */
        test('closing after opening two facilities in a row returns to the list', async ({ page }) => {
            await page.goto('/search?facility=f1')
            await expect(page.getByTestId('search-details-panel')).toBeVisible()
            await page.getByTestId('search-details-close').click()
            await expect(page.getByTestId('search-details-panel')).toBeHidden()

            await page.goto('/search?facility=f2')
            await expect(page.getByTestId('search-details-panel')).toBeVisible()
            await page.getByTestId('search-details-close').click()

            await expect(page.getByTestId('search-details-panel')).toBeHidden()
            await expect(page).not.toHaveURL(/facility=/)
            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
        })

        test('Escape closes the details panel from anywhere in it', async ({ page }) => {
            await page.goto('/search?facility=f1')
            await expect(page.getByTestId('search-details-panel')).toBeVisible()

            await page.keyboard.press('Escape')

            await expect(page.getByTestId('search-details-panel')).toBeHidden()
        })

        test('shows an empty state with a way out', async ({ page }) => {
            await page.goto('/search?specialty=dentistry&prefecture=hokkaido')

            const empty = page.getByTestId('search-empty')
            await expect(empty).toBeVisible()
            await expect(empty.getByText(enUS.searchResultsList.noResults)).toBeVisible()

            await empty.getByRole('button', { name: enUS.search.clearFilters }).click()

            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
        })

        test('shows an error state with a retry when the API is down', async ({ page }) => {
            await page.unrouteAll()
            await mockSnapshot(page)
            await mockApi(page, { fail: true })
            await page.goto('/search')

            const error = page.getByTestId('search-load-error')
            await expect(error).toBeVisible({ timeout: 20000 })
            await expect(error.getByRole('button', { name: enUS.search.retry })).toBeVisible()
        })

        test('shows the build snapshot instead of the error when the API is down (#242)', async ({ page }) => {
            await page.unrouteAll()
            await mockSnapshot(page, {
                version: SEARCH_DIRECTORY_SNAPSHOT_VERSION,
                generatedAt: '2026-11-01T00:00:00.000Z',
                facilities,
                professionals
            })
            await mockApi(page, { fail: true })
            await page.goto('/search')

            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
            await expect(page.getByTestId('search-load-error')).toHaveCount(0)
        })

        test('retry loads the results once the API is back', async ({ page }) => {
            await page.unrouteAll()
            await mockSnapshot(page)
            await mockApi(page, { fail: true })
            await page.goto('/search')

            const error = page.getByTestId('search-load-error')
            await expect(error).toBeVisible({ timeout: 20000 })

            await page.unrouteAll()
            await mockSnapshot(page)
            await mockApi(page)
            await error.getByRole('button', { name: enUS.search.retry }).click()

            await expect(page.getByTestId('search-result-card')).toHaveCount(3)
            await expect(error).toBeHidden()
        })
    })

    test.describe('Portrait mode', () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 320, height: 568 })
        })

        test('keeps the filters behind a button and the results in front', async ({ page }) => {
            await page.goto('/search')

            await expect(page.getByTestId('search-filters')).toBeHidden()
            await expect(page.getByTestId('search-result-card').first()).toBeVisible()

            await page.getByTestId('search-filters-toggle').click()

            await expect(page.getByTestId('search-filters')).toBeVisible()
            await expect(page.getByTestId('search-specialty')).toBeVisible()
        })

        test('shows the chosen filters while the bar is collapsed', async ({ page }) => {
            await page.goto('/search?language=en&prefecture=tokyo')

            await expect(page.getByTestId('search-filters')).toBeHidden()
            await expect(page.getByTestId('search-filter-summary')).toHaveText('English · Tokyo')
        })

        test('clinic page links are real hrefs in portrait too', async ({ page }) => {
            await page.goto('/search')

            await expect(page.getByRole('link', { name: 'Tokyo Family Clinic' }))
                .toHaveAttribute('href', '/clinic/tokyo/shibuya/tokyo-family-clinic--f1')
        })

        test('a shared ?facility= link opens details full screen', async ({ page }) => {
            await page.goto('/search?facility=f1')

            await expect(page.getByTestId('search-details-panel')).toBeVisible()

            await page.getByTestId('search-details-close').click()

            await expect(page.getByTestId('search-details-panel')).toBeHidden()
            await expect(page.getByTestId('search-result-card').first()).toBeVisible()
        })

        test('shows the map above the list on demand', async ({ page }) => {
            await page.goto('/search')
            await page.getByTestId('search-map-toggle').click()

            await expect(page.getByTestId('search-map-panel')).toBeVisible()
        })
    })

    test.describe('Near me', () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 1728, height: 1077 })
        })

        test('sorts every result nearest first and shows each distance', async ({ page }) => {
            const requestUrls: string[] = []
            page.on('request', request => requestUrls.push(`${request.url()} ${request.postData() ?? ''}`))
            await stubLocation(page, { permission: 'prompt', answer: VISITOR_IN_KYOTO })
            await page.goto('/search')
            await expect(cardNames(page)).toHaveText(['Tokyo Family Clinic', 'Osaka Dental', 'Sapporo Skin Clinic'])

            await page.getByTestId('search-near-me').click()

            await expect(cardNames(page)).toHaveText(['Osaka Dental', 'Tokyo Family Clinic', 'Sapporo Skin Clinic'])
            await expect(page.getByTestId('search-near-me')).toHaveAttribute('aria-pressed', 'true')
            await expect(page.getByTestId('search-result-distance').first()).toHaveText(/^\d+ km away$/)
            await expect(page.getByTestId('search-near-me-status')).toHaveText(enUS.search.nearMeSorted)
            await expect(page).toHaveURL(/[?&]sort=near/)

            // The position stays on the device: not in the URL, and not in any request.
            expect(page.url()).not.toContain(String(VISITOR_IN_KYOTO.latitude))
            expect(requestUrls.filter(url => url.includes(String(VISITOR_IN_KYOTO.latitude)))).toEqual([])
        })

        test('orders only what the filters leave', async ({ page }) => {
            await stubLocation(page, { permission: 'prompt', answer: VISITOR_IN_KYOTO })
            await page.goto('/search?specialty=dentistry')
            await expect(page.getByTestId('search-result-card')).toHaveCount(2)

            await page.getByTestId('search-near-me').click()

            await expect(cardNames(page)).toHaveText(['Osaka Dental', 'Tokyo Family Clinic'])
            await expect(page).toHaveURL(/specialty=dentistry/)
        })

        test('turns off again and goes back to directory order', async ({ page }) => {
            await stubLocation(page, { permission: 'prompt', answer: VISITOR_IN_KYOTO })
            await page.goto('/search')
            await page.getByTestId('search-near-me').click()
            await expect(cardNames(page).first()).toHaveText('Osaka Dental')

            await page.getByTestId('search-near-me').click()

            await expect(cardNames(page).first()).toHaveText('Tokyo Family Clinic')
            await expect(page.getByTestId('search-result-distance')).toHaveCount(0)
            await expect(page).not.toHaveURL(/sort=near/)
        })

        test('never asks for the location on page load, even from a shared sort=near link', async ({ page }) => {
            await stubLocation(page, { permission: 'prompt', answer: VISITOR_IN_KYOTO })
            await page.goto('/search?sort=near')
            await expect(page.getByTestId('search-result-card')).toHaveCount(3)

            expect(await locationRequests(page)).toBe(0)
            await expect(cardNames(page).first()).toHaveText('Tokyo Family Clinic')
            await expect(page.getByTestId('search-near-me')).toHaveAttribute('aria-pressed', 'false')
        })

        test('sorts a shared sort=near link on arrival when location is already allowed', async ({ page }) => {
            await stubLocation(page, { permission: 'granted', answer: VISITOR_IN_KYOTO })
            await page.goto('/search?sort=near')

            await expect(cardNames(page).first()).toHaveText('Osaka Dental')
            await expect(page.getByTestId('search-near-me')).toHaveAttribute('aria-pressed', 'true')
        })

        test('offers the area filter when location is refused', async ({ page }) => {
            await stubLocation(page, { permission: 'prompt', answer: 'denied' })
            await page.goto('/search')
            await expect(page.getByTestId('search-result-card')).toHaveCount(3)

            await page.getByTestId('search-near-me').click()

            await expect(page.getByTestId('search-near-me-status')).toContainText(enUS.search.nearMeDenied)
            await expect(cardNames(page).first()).toHaveText('Tokyo Family Clinic')
            await page.getByTestId('search-near-me-choose-area').click()
            await expect(page.getByTestId('search-region')).toBeFocused()
        })
    })
})
