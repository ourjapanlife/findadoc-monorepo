/* eslint-disable camelcase -- Google consent mode field names (ad_storage, ad_user_data). */
import { expect, test, type Page } from '@playwright/test'

/**
 * No request reaches Google before the visitor accepts, Accept switches the tag
 * on, and Decline switches it off again. Every Google host is intercepted and
 * counted, so this checks the network, not just our own state.
 *
 * The e2e dev server has no tag ids. Testing mode reads them from localStorage
 * (E2E_GOOGLE_TAG_IDS_KEY in utils/consent.ts).
 */

const TAG_ID = 'AW-E2E0000001'
const GOOGLE_HOSTS = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|google\.com\/(ccm|pagead)/

async function trackGoogle(page: Page): Promise<string[]> {
    const requests: string[] = []
    await page.addInitScript(id => {
        window.localStorage.setItem('findadoc.e2e.googleTagIds', JSON.stringify([id]))
    }, TAG_ID)
    await page.route(GOOGLE_HOSTS, async route => {
        requests.push(route.request().url())
        // A stand-in gtag.js: loads, sends nothing further.
        await route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* gtag stub */' })
    })
    return requests
}

async function consentCalls(page: Page): Promise<unknown[][]> {
    return page.evaluate(() => ((window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? [])
        .map(entry => Array.from(entry))
        .filter(call => call[0] === 'consent' || call[0] === 'config' || call[0] === 'js')
        .map(call => call[0] === 'js' ? ['js'] : call))
}

test.describe('Google tag consent', () => {
    test('nothing goes to Google before a choice, and Accept switches it on', async ({ page }) => {
        const google = await trackGoogle(page)
        await page.goto('/privacypolicy')

        await expect(page.getByTestId('consent-banner')).toBeVisible()
        await page.waitForLoadState('networkidle')
        expect(google).toEqual([])
        expect(await consentCalls(page)).toEqual([
            ['consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                analytics_storage: 'denied',
                ad_personalization: 'denied'
            }]
        ])

        await page.getByTestId('consent-accept').click()

        await expect(page.getByTestId('consent-banner')).toBeHidden()
        await expect.poll(() => google.length).toBe(1)
        expect(google[0]).toContain(`googletagmanager.com/gtag/js?id=${TAG_ID}`)
        const after = await consentCalls(page)
        const update = after.findIndex(call => call[1] === 'update')
        const config = after.findIndex(call => call[0] === 'config')
        expect(after[update]).toEqual(['consent', 'update', {
            ad_storage: 'granted',
            ad_user_data: 'granted',
            analytics_storage: 'granted',
            ad_personalization: 'denied'
        }])
        expect(update).toBeLessThan(config)
        expect(after[config]).toEqual(['config', TAG_ID])
    })

    test('a returning visitor who accepted gets the tag on load, without the banner', async ({ page, context }) => {
        await context.addCookies([{ name: 'fad_consent', value: 'granted', url: 'http://localhost:4242' }])
        const google = await trackGoogle(page)
        await page.goto('/privacypolicy')

        await expect.poll(() => google.length).toBe(1)
        await expect(page.getByTestId('consent-banner')).toBeHidden()
    })

    test('Decline sends nothing, now or on the next page', async ({ page }) => {
        const google = await trackGoogle(page)
        await page.goto('/privacypolicy')
        await page.getByTestId('consent-decline').click()

        await expect(page.getByTestId('consent-banner')).toBeHidden()
        expect((await page.context().cookies()).find(c => c.name === 'fad_consent')?.value).toBe('denied')

        await page.goto('/about')
        await page.waitForLoadState('networkidle')
        await expect(page.getByTestId('consent-banner')).toBeHidden()
        expect(google).toEqual([])
    })

    test('changing Accept to Decline reloads without the tag and deletes Google cookies', async ({ page, context }) => {
        await context.addCookies([
            { name: 'fad_consent', value: 'granted', url: 'http://localhost:4242' },
            { name: '_ga', value: 'GA1.1.123', url: 'http://localhost:4242' },
            { name: '_gcl_au', value: '1.1.456', url: 'http://localhost:4242' }
        ])
        const google = await trackGoogle(page)
        await page.goto('/privacypolicy')
        await expect.poll(() => google.length).toBe(1)

        await page.getByTestId('cookie-settings-link').click()
        await expect(page.getByTestId('consent-banner')).toBeVisible()
        await Promise.all([
            page.waitForEvent('load'),
            page.getByTestId('consent-decline').click()
        ])
        await page.waitForLoadState('networkidle')

        const cookies = await context.cookies()
        expect(cookies.find(c => c.name === 'fad_consent')?.value).toBe('denied')
        expect(cookies.find(c => c.name === '_ga')).toBeUndefined()
        expect(cookies.find(c => c.name === '_gcl_au')).toBeUndefined()
        // The reloaded page has no tag, and no further request went to Google.
        expect(await page.locator('script[data-google-tag]').count()).toBe(0)
        expect(google).toHaveLength(1)
    })
})
