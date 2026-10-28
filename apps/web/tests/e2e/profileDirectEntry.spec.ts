import enUS from '../../i18n/locales/en.json' with { type: 'json' }
import { test, expect } from '@playwright/test'

test.describe('Direct entry to dynamic routes', () => {
    test('loads a profile URL on first request', async ({ page }) => {
        const response = await page.goto('/u/direct-entry-user')

        expect(response?.status()).toBe(200)
        await expect(page).toHaveURL(/\/u\/direct-entry-user/)
        await expect(page.getByRole('heading', { name: enUS.profile.edit })).toBeVisible()
    })

    test('unknown paths return a real 404', async ({ page }) => {
        const response = await page.goto('/nonexistent-page-xyz')

        expect(response?.status()).toBe(404)
        await expect(page.getByRole('heading', { name: enUS.errorPage.title })).toBeVisible()
        // One chrome only — pages/404 used to nest error-layout inside default.
        await expect(page.getByTestId('top-nav')).toHaveCount(1)
        await expect(page.getByTestId('footer')).toHaveCount(1)
    })

    test('the /404 route shows the not-found page once', async ({ page }) => {
        await page.goto('/404')

        await expect(page.getByRole('heading', { name: enUS.errorPage.title })).toBeVisible()
        await expect(page.getByTestId('top-nav')).toHaveCount(1)
        await expect(page.getByTestId('footer')).toHaveCount(1)
    })
})
