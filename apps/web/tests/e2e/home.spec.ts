import enUS from '../../i18n/locales/en.json' with { type: 'json' }
import koKR from '../../i18n/locales/ko.json' with { type: 'json' }
import ruRU from '../../i18n/locales/ru.json' with { type: 'json' }
import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
    test.describe('Landscape mode', () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 1728, height: 1077 })
            await page.goto('/')
        })

        test('shows the value proposition immediately, with no onboarding gate', async ({ page }) => {
            await expect(page.getByTestId('home-heading')).toHaveText(enUS.home.heroHeading)
        })

        test('displays the logo', async ({ page }) => {
            await expect(page.getByRole('img', { name: /Find a Doc, Japan/i }).first()).toBeVisible()
        })

        test('offers a search entry without loading the map', async ({ page }) => {
            await expect(page.getByTestId('home-search-entry')).toBeVisible()
            await expect(page.getByRole('region', { name: 'Map' })).toHaveCount(0)
        })

        test('does not show the hamburger on desktop', async ({ page }) => {
            await expect(page.getByRole('button', { name: /menu/i })).toBeHidden()
        })

        test('footer links are present', async ({ page }) => {
            await expect(page.getByRole('link', { name: /privacy/i })).toBeVisible()
            await expect(page.getByTestId('npo-link')).toBeVisible()
            // Contribute points at the docs site, not at one of several repos.
            await expect(page.getByTestId('contribute-link')).toHaveAttribute('href', /docs\.findadoc\.jp/)
        })

        test('links the insurance guide from the desktop header, in the visitor\'s locale', async ({ page }) => {
            const link = page.getByTestId('top-nav-insurance-link')
            await expect(link).toBeVisible()
            await expect(link).toHaveText(enUS.topNav.insurance)
            await expect(link).toHaveAttribute('href', '/insurance')

            await page.goto('/ko-KR')
            await expect(link).toHaveText(koKR.topNav.insurance)
            await expect(link).toHaveAttribute('href', '/ko-KR/insurance')
        })

        test('navigates to privacy policy', async ({ page }) => {
            await page.getByRole('link', { name: /privacy/i }).click()
            await expect(page).toHaveURL(/\/privacypolicy/)
        })

        test('the search entry carries its filters into the URL', async ({ page }) => {
            await page.getByTestId('home-specialty').selectOption('dentistry')
            await page.getByTestId('home-language').selectOption('en')
            await page.getByTestId('home-area').selectOption('tokyo')
            await page.getByTestId('home-search-submit').click()

            await expect(page).toHaveURL(/\/search\?/)
            const url = new URL(page.url())
            expect(url.searchParams.get('specialty')).toBe('dentistry')
            expect(url.searchParams.get('language')).toBe('en')
            expect(url.searchParams.get('prefecture')).toBe('tokyo')
        })

        /*
         * The homepage is prerendered, so the form is clickable before Vue hydrates.
         * Submitting at that moment must still reach /search with the filters rather
         * than firing a native GET back to "/" — this is what a fast user hits.
         */
        test('the search entry works before hydration', async ({ page }) => {
            await page.goto('/', { waitUntil: 'commit' })
            await page.getByTestId('home-specialty').selectOption('dentistry')
            await page.getByTestId('home-area').selectOption('tokyo')
            await page.getByTestId('home-search-submit').click()

            await expect(page).toHaveURL(/\/search\?/)
            const url = new URL(page.url())
            expect(url.searchParams.get('specialty')).toBe('dentistry')
            expect(url.searchParams.get('prefecture')).toBe('tokyo')
        })

        test('a category tile prefers an indexable specialty facet', async ({ page }) => {
            const tile = page.getByTestId('home-category-DENTAL')
            const href = await tile.getAttribute('href')
            /*
             * Production generate links to /tokyo/dentistry. If Tokyo has no
             * dentistry facet in this build, categorySpecialtyLink uses another
             * prefecture's facet. Sparse CI seeds often have none, so the tile
             * falls back to filtered search.
             */
            expect(href === '/search?specialty=dentistry' || /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(href ?? '')).toBe(true)

            if (href && !href.startsWith('/search')) {
                await tile.click()
                await expect(page.getByTestId('hub-facet-page')).toBeVisible()
            }
        })

        test('an area chip opens a prefecture hub when this generate built one', async ({ page }) => {
            const chip = page.locator('[data-testid^="home-prefecture-"]').first()
            const href = await chip.getAttribute('href')
            /*
             * Production generate links Tokyo at /tokyo. Sparse CI seeds often
             * have no Tokyo row — the homepage then shows hubs this build did
             * prerender, not a noindex /search?prefecture=tokyo chip. Search is
             * only the fallback when generate found no prefecture hubs at all.
             */
            if (href?.startsWith('/search')) {
                await expect(chip).toHaveAttribute('href', /\/search\?prefecture=/)
                return
            }

            expect(href).toMatch(/^\/[a-z0-9-]+$/)
            await chip.click()
            await expect(page.getByTestId('hub-prefecture-page')).toBeVisible()
        })

        test('links to the submission form', async ({ page }) => {
            await expect(page.getByTestId('home-contribute-cta')).toBeVisible()
            await page.getByTestId('home-contribute-cta').click()
            await expect(page).toHaveURL(/\/submit/)
        })

        test('switches the site into Korean from the language picker', async ({ page }) => {
            const localeSelect = page.locator('[data-testid="locale-selector"] select:visible')
            const labels = await localeSelect.locator('option').allTextContents()

            expect(labels[0]).toBe('English')
            expect(labels[1]).toBe('日本語')
            expect(labels).toContain('한국어')
            expect(labels.indexOf('简体中文')).toBeLessThan(labels.indexOf('한국어'))

            // The page is prerendered: a choice made before Vue hydrates the picker is lost,
            // which made WebKit flaky. Pick again until the page answers.
            await expect(async () => {
                await localeSelect.selectOption('ko_KR')
                await expect(page.getByTestId('home-heading')).toHaveText(koKR.home.heroHeading, { timeout: 2000 })
            }).toPass({ timeout: 15000 })
        })
    })

    // Below 1280px the desktop links do not fit in every locale, so a landscape window
    // that narrow gets the hamburger. Portuguese has the longest labels.
    test.describe('Narrow landscape', () => {
        for (const width of [820, 1024]) {
            test(`uses the hamburger and never scrolls sideways at ${width}px`, async ({ page }) => {
                await page.setViewportSize({ width, height: 700 })

                for (const path of ['/', '/pt-BR', '/ru-RU']) {
                    await page.goto(path)
                    await expect(page.getByTestId('hamburger-menu-icon')).toBeVisible()
                    await expect(page.getByTestId('top-nav-desktop-links')).toBeHidden()
                    const overflows = await page.evaluate(() =>
                        document.documentElement.scrollWidth > window.innerWidth)
                    expect(overflows, path).toBe(false)
                }

                // The page is prerendered: a click before Vue hydrates the button does nothing.
                const insuranceLink = page.getByTestId('hamburger-menu-items')
                    .getByRole('link', { name: ruRU.pageMeta.insuranceTitle })
                await expect(async () => {
                    await page.getByTestId('hamburger-menu-icon').click()
                    await expect(insuranceLink).toBeVisible({ timeout: 2000 })
                }).toPass({ timeout: 15000 })
            })
        }

        test('shows every desktop link, Insurance included, at 1280px without scrolling sideways', async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 720 })

            for (const path of ['/', '/pt-BR', '/ru-RU']) {
                await page.goto(path)
                await expect(page.getByTestId('hamburger-menu-icon')).toBeHidden()
                await expect(page.getByTestId('top-nav-insurance-link')).toBeVisible()
                const overflows = await page.evaluate(() =>
                    document.documentElement.scrollWidth > window.innerWidth)
                expect(overflows, path).toBe(false)
            }
        })
    })

    test.describe('Portrait mode', () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 320, height: 568 })
            await page.goto('/')
        })

        test('shows the logo', async ({ page }) => {
            await expect(page.getByRole('img', { name: /Find a Doc, Japan/i }).first()).toBeVisible()
        })

        test('shows the heading and search entry', async ({ page }) => {
            await expect(page.getByTestId('home-heading')).toBeVisible()
            await expect(page.getByTestId('home-search-entry')).toBeVisible()
        })

        test('shows the hamburger icon', async ({ page }) => {
            await expect(page.getByRole('button', { name: /menu/i })).toBeVisible()
        })
    })
})
