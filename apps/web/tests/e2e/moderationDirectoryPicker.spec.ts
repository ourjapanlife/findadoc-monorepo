import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * The picker used to filter the first loaded page in the browser.
 * A name from the next list page has to come back from a directory query.
 */
test.describe('Moderation directory search pickers', () => {
    test.describe.configure({ timeout: 120_000 })

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1728, height: 1077 })
        await page.goto('/my-page?view=submissions')
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByTestId('mod-access-panel')).toBeVisible({ timeout: 30_000 })
    })

    test('facility picker finds a clinic from the next list page', async ({ page }) => {
        const name = await nameOnSecondPage(page, 'access-page-link-moderation-facilities', 'mod-facility-list-item-1')
        await page.goto('/my-page/create-healthcare-professional')
        await expect(page.getByTestId('mod-healthcare-professional-section-facilities')).toBeVisible()
        await expectDirectorySearch(
            page,
            'mod-healthcare-professional-section-facilities',
            name
        )
    })

    test('professional picker finds a person from the next list page', async ({ page }) => {
        const label = await nameOnSecondPage(
            page,
            'access-page-link-moderation-healthcare-professionals',
            'mod-healthcare-professional-list-item-1'
        )
        const name = label.split(/\s+/).find(part => part.length > 0) ?? label
        await page.goto('/my-page/create-facility')
        await expect(page.getByTestId('mod-facility-section-doctor-search')).toBeVisible()
        await expectDirectorySearch(page, 'mod-facility-section-doctor-search', name)
    })
})

async function nameOnSecondPage(page: Page, navTestId: string, rowTestId: string): Promise<string> {
    await page.getByTestId(navTestId).click()
    const firstRow = page.getByTestId(rowTestId)
    await expect(firstRow).toBeVisible({ timeout: 30_000 })
    // Numbered page buttons hide when the pager is narrow. Ten rows makes a second page, and the arrow stays.
    const nextPage = page.getByTestId('mod-pagination-next')
    await page.locator('#items-per-page-select').selectOption('10')
    await expect(nextPage.locator('..')).toContainText('1-10')
    const firstPageName = (await firstRow.innerText()).trim()
    await expect(nextPage).toBeEnabled()
    await nextPage.click()
    await expect(nextPage.locator('..')).toContainText('11-')
    await expect(firstRow).not.toHaveText(firstPageName)
    return (await firstRow.innerText()).trim()
}

async function expectDirectorySearch(page: Page, inputTestId: string, name: string) {
    const query = name.toLowerCase()
    const searchRequest = page.waitForRequest(request => directoryQuery(request, query))
    const input = page.getByTestId(inputTestId)
    await input.scrollIntoViewIfNeeded()
    await input.fill(name)
    await searchRequest
    await expect(page.getByTestId('mod-search-bar-search-result').filter({ hasText: name })).toBeVisible()
}

function directoryQuery(request: Request, query: string): boolean {
    if (request.method() !== 'POST') {
        return false
    }
    const raw = request.postData()
    if (raw === null || !raw.includes(query)) {
        return false
    }
    try {
        const body: unknown = JSON.parse(raw)
        const entries = Array.isArray(body) ? body : [body]
        return entries.some(entry => {
            if (typeof entry !== 'object' || entry === null || !('variables' in entry)) {
                return false
            }
            const variables = entry.variables
            if (typeof variables !== 'object' || variables === null || !('listFilters' in variables)) {
                return false
            }
            const filters = variables.listFilters
            return typeof filters === 'object'
              && filters !== null
              && 'query' in filters
              && filters.query === query
        })
    } catch {
        return false
    }
}
