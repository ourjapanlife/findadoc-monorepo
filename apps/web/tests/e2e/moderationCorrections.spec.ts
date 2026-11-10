import enUS from '../../i18n/locales/en.json' with { type: 'json' }
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/*
 * A moderator reviews visitor corrections from the User feedback queue (#22). The seed holds two
 * pending corrections on Minato clinics: Wrong languages, and Wrong phone or website with Other.
 * Chromium only: both tests decide a seeded correction, and the next browser would find it gone.
 */

const LOCAL_API = 'http://127.0.0.1:4000'

type FacilityLanguages = { supportedLanguages: string[], contact: { phone: string } | null }

async function facilityFromApi(request: APIRequestContext, id: string): Promise<FacilityLanguages> {
    const response = await request.post(LOCAL_API, {
        data: {
            query: 'query Facility($id: ID!) { facility(id: $id) { supportedLanguages contact { phone } } }',
            variables: { id }
        }
    })
    const json = await response.json() as { data?: { facility?: FacilityLanguages | null } }
    const facility = json.data?.facility
    if (!facility) {
        throw new Error('local API returned no facility')
    }
    return facility
}

async function openFeedbackQueue(page: Page) {
    await page.getByTestId('mod-submission-tab-USER_FEEDBACK').click()
    await expect(page.getByTestId('mod-submission-tab-USER_FEEDBACK')).toHaveAttribute('aria-pressed', 'true')
}

async function facilityIdOnReview(page: Page): Promise<string> {
    const href = await page.getByTestId('mod-correction-edit-facility').getAttribute('href')
    const id = href?.split('/').pop()
    if (!id) {
        throw new Error('review screen did not link the facility')
    }
    return id
}

test.describe('Moderation user feedback', () => {
    test.describe.configure({ timeout: 120_000 })

    test.beforeEach(async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'each test decides a seeded correction once')
        await page.setViewportSize({ width: 1728, height: 1077 })
        await page.goto('/my-page?view=submissions')
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByTestId('access-page-link-moderation-submissions')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('mod-submission-tab-USER_FEEDBACK')).toBeVisible()
    })

    test('keeps corrections out of bulk selection', async ({ page }) => {
        await openFeedbackQueue(page)
        await expect(page.getByTestId('mod-submission-list-item-1')).toBeVisible()

        await expect(page.getByTestId('mod-table-select-page')).toHaveCount(0)
        await expect(page.locator('[data-testid^="mod-table-select-"]')).toHaveCount(0)
    })

    test('approves a wrong-languages report and changes only the languages', async ({ page, request }) => {
        await openFeedbackQueue(page)
        await page.getByRole('link', { name: enUS.clinicCorrection.reasonWrongLanguages, exact: true }).first().click()

        await expect(page.getByTestId('mod-correction-review')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('mod-correction-reason-WRONG_LANGUAGES')).toBeVisible()
        await expect(page.getByTestId('mod-correction-change-supportedLanguages')).toBeVisible()
        await expect(page.getByTestId('mod-correction-change-phone')).toHaveCount(0)
        // A correction has nothing to save as a draft.
        await expect(page.getByTestId('submission-topNav-update')).toHaveCount(0)

        const facilityId = await facilityIdOnReview(page)
        const before = await facilityFromApi(request, facilityId)

        await page.getByTestId('mod-edit-submission-approve-button').click()
        await expect(page.getByText(enUS.modCorrectionReview.approveConfirm, { exact: true })).toBeVisible()
        await page.getByRole('button', { name: enUS.modCorrectionReview.approveConfirmButton }).click()

        await expect(page.getByText(enUS.modCorrectionReview.approved, { exact: true })).toBeVisible()
        await expect(page).not.toHaveURL(/\/edit-submission\//)

        const after = await facilityFromApi(request, facilityId)
        expect(after.supportedLanguages).not.toEqual(before.supportedLanguages)
        expect(after.contact?.phone).toBe(before.contact?.phone)
    })

    test('declines a contact report and files it under Rejected with the Feedback tag', async ({ page, request }) => {
        await openFeedbackQueue(page)
        await page.getByRole('link', { name: new RegExp(enUS.clinicCorrection.reasonWrongContact, 'i') }).first().click()

        await expect(page.getByTestId('mod-correction-review')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('mod-correction-change-phone')).toBeVisible()
        await expect(page.getByTestId('mod-correction-reason-OTHER')).toBeVisible()

        const facilityId = await facilityIdOnReview(page)
        const before = await facilityFromApi(request, facilityId)

        await page.getByTestId('mod-edit-submission-reject-button').click()
        await page.getByRole('button', { name: enUS.modCorrectionReview.declineConfirmButton }).click()
        await expect(page.getByText(enUS.modCorrectionReview.declined, { exact: true })).toBeVisible()

        const after = await facilityFromApi(request, facilityId)
        expect(after.contact?.phone).toBe(before.contact?.phone)

        await page.getByTestId('mod-submission-tab-REJECTED').click()
        const declinedRow = page.locator('tr', {
            has: page.getByRole('link', { name: new RegExp(enUS.clinicCorrection.reasonWrongContact, 'i') })
        })
        await expect(declinedRow.getByTestId('mod-status-pill-DECLINED')).toBeVisible()
        await expect(declinedRow.getByTestId('mod-status-pill-FEEDBACK')).toBeVisible()
    })
})
