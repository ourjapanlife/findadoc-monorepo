import { facilityDocumentTitle, facilityPath } from '../../utils/clinicPath'
import { facilitySelection } from '../../utils/graphqlSelection'
import { canonicalUrl } from '../../utils/seo'
import { formatPageTitle } from '../../utils/site'
import { test, expect } from '@playwright/test'
import { jsonLdBlocks } from './jsonLd'
import { assertLocalApiOk, requireLocalRows, skipIfLocalApiIsDown } from './localApi'

const UNKNOWN_CLINIC_PATH
    = '/clinic/tokyo/shibuya/missing--00000000-0000-4000-8000-000000000001'

test.describe('Facility pages', () => {
    test('an unknown id is a real HTTP 404, not an SPA 200', async ({ request }) => {
        const response = await request.get(UNKNOWN_CLINIC_PATH)

        expect(response.status()).toBe(404)
    })

    test('renders a seeded facility when the local API is up', async ({ page, request }) => {
        let facility: {
            id: string
            nameEn: string
            contact?: { address?: { cityEn?: string, prefectureEn?: string } }
        } | undefined

        try {
            const response = await request.post('http://127.0.0.1:4000', {
                data: {
                    query: `query {
                        facilities(filters: { limit: 1 }) {
                            ${facilitySelection}
                        }
                    }`
                }
            })
            const json = await response.json() as {
                data?: { facilities?: typeof facility[] }
                errors?: unknown[]
            }
            assertLocalApiOk(json)
            facility = requireLocalRows(json.data?.facilities, 'local API returned no facilities')[0]
        } catch (error) {
            skipIfLocalApiIsDown(error)
            return
        }

        expect(facility?.id).toBeTruthy()
        expect(facility?.nameEn).toBeTruthy()
        if (!facility?.id || !facility.nameEn) {
            return
        }

        const path = facilityPath(facility)
        await page.goto(path)

        await expect(page.getByTestId('clinic-page')).toBeVisible()
        await expect(page.getByRole('heading', { level: 1, name: facility.nameEn })).toBeVisible()
        await expect(page).toHaveTitle(formatPageTitle(facilityDocumentTitle(facility.nameEn)))
        await expect(page.getByTestId('clinic-back-to-search')).toBeVisible()
        await expect(page.getByTestId('breadcrumbs')).toBeVisible()

        const blocks = await jsonLdBlocks(page)
        const clinic = blocks.find(block => block['@type'] === 'MedicalClinic')
        expect(clinic?.name).toBe(facility.nameEn)
        expect(clinic?.url).toBe(canonicalUrl(path))
        const crumbs = blocks.find(block => block['@type'] === 'BreadcrumbList')
        expect(Array.isArray(crumbs?.itemListElement)).toBe(true)
    })

    /*
     * A signed-out visitor reports wrong languages on a published clinic (#22).
     * Chromium only: the API allows five corrections an hour from one address, so every
     * browser project sending one would spend the budget the next local run needs.
     */
    test('a visitor reports wrong languages from the clinic page', async ({ page, request, browserName }) => {
        test.skip(browserName !== 'chromium', 'one correction per run keeps the hourly budget for reruns')

        let facility: {
            id: string
            nameEn: string
            cityId?: string | null
            verificationStatus?: string | null
            contact?: { address?: { cityEn?: string, prefectureEn?: string } }
        } | undefined

        try {
            const response = await request.post('http://127.0.0.1:4000', {
                data: {
                    query: `query {
                        facilities(filters: { limit: 50 }) {
                            ${facilitySelection}
                        }
                    }`
                }
            })
            const json = await response.json() as {
                data?: { facilities?: NonNullable<typeof facility>[] }
                errors?: unknown[]
            }
            assertLocalApiOk(json)
            const published = requireLocalRows(json.data?.facilities, 'local API returned no facilities')
                .filter(row => row.cityId && row.verificationStatus !== 'UNVERIFIED_LOCATION')
            facility = requireLocalRows(published, 'local API returned no published facility')[0]
        } catch (error) {
            skipIfLocalApiIsDown(error)
            return
        }

        if (!facility) {
            return
        }

        await page.goto(facilityPath(facility))
        await expect(page.getByTestId('clinic-correction-prompt')).toHaveAttribute('data-hydrated', 'true')
        await page.getByTestId('clinic-correction-open').click()

        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()

        const reason = page.getByTestId('clinic-correction-reason-WRONG_LANGUAGES')
        await reason.click()
        await expect(reason).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByTestId('clinic-correction-field-languages')).toBeVisible()
        await expect(page.getByTestId('clinic-correction-field-contact')).toHaveCount(0)

        await page.getByTestId('clinic-correction-language-zh_CN').click()
        await page.getByTestId('clinic-correction-relation-PATIENT').check()
        await page.getByTestId('clinic-correction-submit').click()

        await expect(page.getByTestId('clinic-correction-thanks')).toBeVisible()
        await page.getByTestId('clinic-correction-back').click()
        await expect(dialog).toHaveCount(0)
    })

    test('the correction form closes on Escape and needs a reason', async ({ page, request }) => {
        let facility: { id: string, nameEn: string, cityId?: string | null } | undefined

        try {
            const response = await request.post('http://127.0.0.1:4000', {
                data: {
                    query: `query {
                        facilities(filters: { limit: 1 }) {
                            ${facilitySelection}
                        }
                    }`
                }
            })
            const json = await response.json() as {
                data?: { facilities?: NonNullable<typeof facility>[] }
                errors?: unknown[]
            }
            assertLocalApiOk(json)
            facility = requireLocalRows(json.data?.facilities, 'local API returned no facilities')[0]
        } catch (error) {
            skipIfLocalApiIsDown(error)
            return
        }

        if (!facility) {
            return
        }

        await page.goto(facilityPath(facility))
        await expect(page.getByTestId('clinic-correction-prompt')).toHaveAttribute('data-hydrated', 'true')
        await page.getByTestId('clinic-correction-open').click()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Nothing picked: the form stays open and asks for a reason instead of sending.
        await page.getByTestId('clinic-correction-submit').click()
        await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()

        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.getByTestId('clinic-correction-open')).toBeFocused()
    })
})
