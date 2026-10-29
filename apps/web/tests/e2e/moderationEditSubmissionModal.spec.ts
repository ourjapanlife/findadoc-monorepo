import enUS from '../../i18n/locales/en.json' with { type: 'json' }
import { test, expect, type Page, type Route } from '@playwright/test'

async function navigateToFirstSubmissionEditPage(page: Page) {
    await page.getByTestId('access-page-link-moderation-submissions').click()
    // Default tab is "New"; CI seed data has submissions under "For Review".
    await page.getByRole('button', { name: new RegExp(enUS.modDashboardLeftNav.forReview, 'i') }).click()
    const firstSubmission = page.locator('[data-testid^="mod-submission-list-item-"]').first()
    await expect(firstSubmission).toBeVisible({ timeout: 30_000 })
    await firstSubmission.click()
    await expect(page.getByTestId('mod-access-panel')).toBeVisible()
    await expect(page.getByTestId('access-page-link-moderation-submissions')).toBeVisible()
    const facilityNameInput = page.getByPlaceholder(enUS.modFacilitySection.placeholderTextFacilityNameEn)
    await expect(facilityNameInput).toBeVisible()
}

test.describe('Moderation edit submission topbar modals', () => {
    test.describe.configure({ timeout: 120_000 })
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1728, height: 1077 })
        await page.goto('/my-page?view=submissions')
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByTestId('access-page-link-moderation-submissions')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('button', { name: new RegExp(enUS.modDashboardLeftNav.forReview, 'i') })).toBeVisible()
    })

    test('opens approve confirmation modal from topbar action', async ({ page }) => {
        await navigateToFirstSubmissionEditPage(page)

        await page.getByRole('button', { name: new RegExp(enUS.modEditSubmissionTopNav.approve, 'i') }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(page.getByText(enUS.modSubmissionForm.submissionConfirmationMessage)).toBeVisible()
    })

    test('opens reject confirmation modal from topbar action', async ({ page }) => {
        await navigateToFirstSubmissionEditPage(page)

        await page.getByTestId('mod-edit-submission-reject-button').click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(page.getByText(enUS.modSubmissionForm.rejectSubmissionConfirmationMessage)).toBeVisible()
    })

    test('keeps the form and reports a failed save', async ({ page }) => {
        await navigateToFirstSubmissionEditPage(page)
        await page.getByTestId('mod-form-mode-toggle').click()

        const facilityName = page.getByPlaceholder(enUS.modFacilitySection.placeholderTextFacilityNameEn)
        const keptName = 'Kept after a failed save'
        await facilityName.fill(keptName)
        await failUpdateSubmission(page, 'network')
        await page.getByTestId('submission-topNav-update').click()

        await expect(page.getByText(enUS.serverErrorMessages.network)).toBeVisible()
        await expect(page.getByText(enUS.modSubmissionForm.successMessageUpdated)).toHaveCount(0)
        await expect(facilityName).toHaveValue(keptName)
        await expect(page).toHaveURL(/\/my-page\/edit-submission\//)
    })

    test('reports a failed reject and stays on the submission', async ({ page }) => {
        await navigateToFirstSubmissionEditPage(page)
        await failUpdateSubmission(page, 'server')

        await page.getByTestId('mod-edit-submission-reject-button').click()
        await page.getByRole('button', { name: enUS.modSubmissionForm.rejectSubmissionConfirmationButton }).click()

        await expect(page.getByText(enUS.serverErrorMessages.serverUnavailable)).toBeVisible()
        await expect(page.getByText(enUS.modSubmissionForm.submissionRejected)).toHaveCount(0)
        await expect(page.getByTestId('mod-edit-submission-approve-button')).toBeVisible()
        await expect(page).toHaveURL(/\/my-page\/edit-submission\//)
    })
})

function isApiRequest(url: URL): boolean {
    return (url.hostname === '127.0.0.1' && url.port === '4000')
      || (url.hostname === 'localhost' && url.port === '4000')
      || url.hostname === 'api.findadoc.jp'
}

async function failUpdateSubmission(page: Page, kind: 'network' | 'server') {
    await page.route(isApiRequest, async (route: Route) => {
        const body = route.request().postData() ?? ''
        if (!body.includes('updateSubmission')) {
            await route.continue()
            return
        }

        if (kind === 'network') {
            await route.abort('failed')
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: { updateSubmission: null },
                errors: [{ message: 'down', extensions: { code: 'SERVER_ERROR' } }]
            })
        })
    })
}
