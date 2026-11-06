/**
 * Compares the live sitemap with the public API and says whether the site needs a rebuild (#228).
 * Clinic and doctor pages are prerendered, so a new, renamed, or deleted entry stays wrong on
 * findadoc.jp until the next build. `.github/workflows/directory-refresh.yml` runs this daily.
 *
 * Writes `stale=true|false` to $GITHUB_OUTPUT. Exits non-zero, and asks for no rebuild, when
 * either side could not be read in full: a build from a partial API list would drop pages.
 * Logs counts only. Paths carry clinic and doctor names, and Actions logs are public.
 */
import { appendFileSync } from 'node:fs'
import { fetchDirectoryRows } from '../utils/clinicPrerender'
import { directoryDrift, expectedDirectoryPaths, sitemapDirectoryPaths } from '../utils/directoryDrift'

const SITEMAP_URL = process.env.DIRECTORY_SITEMAP_URL ?? 'https://www.findadoc.jp/sitemap.xml'

function writeOutput(stale: boolean) {
    const outputFile = process.env.GITHUB_OUTPUT
    if (outputFile) {
        appendFileSync(outputFile, `stale=${stale}\n`)
    }
}

function writeSummary(lines: string[]) {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY
    if (summaryFile) {
        appendFileSync(summaryFile, `${lines.join('\n')}\n`)
    }
}

async function fetchSitemap(): Promise<string> {
    const response = await fetch(SITEMAP_URL, { headers: { 'cache-control': 'no-cache' } })
    // No sitemap at all means the last build lost it. A rebuild is the fix.
    if (response.status === 404) {
        return ''
    }
    if (!response.ok) {
        throw new Error(`sitemap returned HTTP ${response.status}`)
    }
    return response.text()
}

async function main() {
    const rows = await fetchDirectoryRows()
    if (!rows?.complete) {
        throw new Error('the directory API did not return every page; not asking for a rebuild')
    }
    const expected = expectedDirectoryPaths(rows.facilities, rows.professionals)
    const published = sitemapDirectoryPaths(await fetchSitemap())
    const drift = directoryDrift(expected, published)
    const stale = drift.missing.length > 0 || drift.removed.length > 0

    const lines = [
        `API: ${rows.facilities.length} clinics, ${rows.professionals.length} doctors (${expected.size} pages)`,
        `Live sitemap: ${published.size} clinic and doctor pages`,
        `Not on the site yet: ${drift.missing.length}`,
        `On the site but no longer in the API: ${drift.removed.length}`,
        stale ? 'Rebuilding the site.' : 'Up to date. No rebuild.'
    ]
    console.info(lines.join('\n'))
    writeSummary(lines)
    writeOutput(stale)
}

main().catch((error: unknown) => {
    console.error(`[directory drift] ${error instanceof Error ? error.message : String(error)}`)
    writeOutput(false)
    process.exitCode = 1
})
