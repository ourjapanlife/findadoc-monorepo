import enUS from '../../i18n/locales/en.json' with { type: 'json' }
import { test, expect } from '@playwright/test'
import { submissionStatusChip } from './moderationFilters'

test.describe('Moderation dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1728, height: 1077 })
        await page.goto('/my-page?view=submissions')
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByTestId('mod-access-panel')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('access-page-link-moderation-submissions')).toBeVisible({ timeout: 30_000 })
        await expect(submissionStatusChip(page)).toBeVisible()
    })

    test('shows access panel and primary view navigation for Submissions, Facilities, Healthcare Professionals',
         async ({ page }) => {
             await expect(page.getByTestId('mod-access-panel')).toContainText(enUS.accessPanel.signedInAs)

             await page.getByTestId('access-page-link-moderation-facilities').click()
             await expect(page.getByRole('link', { name: new RegExp(enUS.modDashboardTopbar.addFacility, 'i') })).toBeVisible()

             await page.getByTestId('access-page-link-moderation-healthcare-professionals').click()
             await expect(page.getByRole('link', { name: new RegExp(enUS.modDashboardTopbar.addHealthcareProfessional, 'i') }))
                 .toBeVisible()

             await page.getByTestId('access-page-link-moderation-submissions').click()
             await expect(submissionStatusChip(page)).toBeVisible()
         })

    test('shows scope link for read:submissions when granted', async ({ page }) => {
        await expect(page.getByTestId('access-page-link-moderation-submissions')).toBeVisible({ timeout: 30_000 })
    })

    test('shows the submission queues New, Under review, Approved, Declined, and User feedback',
         async ({ page }) => {
             // Every queue is shown, and ticked, until a moderator unticks one (#313).
             const chip = submissionStatusChip(page)
             await expect(chip).toHaveAttribute('data-active', 'false')
             await chip.click()
             const menu = page.getByTestId('mod-submission-status-filter-menu')
             for (const label of [
                 enUS.modDashboardLeftNav.new,
                 enUS.modDashboardLeftNav.forReview,
                 enUS.modDashboardLeftNav.approved,
                 enUS.modDashboardLeftNav.rejected,
                 enUS.modDashboardLeftNav.userFeedback
             ]) {
                 await expect(menu.getByRole('checkbox', { name: new RegExp(label, 'i') })).toBeChecked()
             }
         })
})

test.describe('Moderation dashboard on a phone', () => {
    test('scrolls the page so facilities and submissions stay reachable under the access panel',
         async ({ page }) => {
             await page.setViewportSize({ width: 390, height: 700 })
             await page.goto('/my-page?view=submissions')
             await page.waitForLoadState('domcontentloaded')
             await expect(page.getByTestId('mod-access-panel')).toBeVisible({ timeout: 30_000 })

             const shell = page.getByTestId('my-page-app')
             await expect(shell).toBeVisible()
             await expect(shell).toHaveClass(/min-h-dvh/)
             await expect(shell).toHaveClass(/md:h-dvh/)

             const search = page.getByTestId('mod-submission-search-input')
             await search.scrollIntoViewIfNeeded()
             await expect(search).toBeInViewport()

             await page.getByRole('button', { name: enUS.accessPanel.sections.moderation }).click()
             await page.getByTestId('access-page-link-moderation-facilities-mobile').click()
             await expect(page).toHaveURL(/view=facilities/)
             await search.scrollIntoViewIfNeeded()
             await expect(search).toBeInViewport()

             const pageGrowsPastViewport = await page.evaluate(() => {
                 const root = document.documentElement
                 return root.scrollHeight > window.innerHeight
             })
             expect(pageGrowsPastViewport).toBe(true)
         })
})
