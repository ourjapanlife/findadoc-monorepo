import { test as setup } from '@playwright/test'

import { auth0Login, consentDeniedCookie } from './fixtures'

/**
 * Resource-owner login + cookies used by Nuxt testing mode (auth_token / id_token).
 * Saved storage state is consumed by the chromium-moderation project. It also
 * stores a cookie choice, so the consent banner never covers moderation controls.
 */
setup('moderation auth', async ({ page, baseURL }) => {
    const url = baseURL ?? 'http://localhost:4242/'
    await page.goto(url)
    await auth0Login(page)
    await page.context().addCookies([consentDeniedCookie(new URL(url).hostname)])
    await page.context().storageState({ path: 'playwright/.auth/moderation.json' })
})
