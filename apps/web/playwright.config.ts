import { defineConfig, devices } from '@playwright/test'

// Load .env so AUTH0_* etc. are available for shouldRunModerationTests() when running locally
import 'dotenv/config'

import { consentDeniedCookie, shouldRunModerationTests } from './tests/e2e/fixtures'

const moderationSpecGlob = '**/moderation*.spec.ts'
const moderationSetupGlob = '**/moderation-auth.setup.ts'

/** CI always runs moderation (expects secrets); locally only when Auth0 env is complete. */
const runModerationSuite = Boolean(process.env.CI) || shouldRunModerationTests()

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4242'

/**
 * Every spec except consent.spec.ts starts with a stored cookie choice, so the
 * banner (shown to undecided visitors on builds with a Google tag) never covers
 * what a test clicks. consent.spec.ts clears this and starts undecided.
 */
const consentDecided = {
    cookies: [consentDeniedCookie(new URL(baseURL).hostname)],
    origins: []
}

function buildProjects(ciBrowsers: boolean) {
    const browserDefs = ciBrowsers
        ? [
            { name: 'chromium', device: devices['Desktop Chrome'] },
            { name: 'firefox', device: devices['Desktop Firefox'] },
            { name: 'webkit', device: devices['Desktop Safari'] }
        ]
        : [{ name: 'chromium', device: devices['Desktop Chrome'] }]

    if (!runModerationSuite) {
        return browserDefs.map(({ name, device }) => ({
            name,
            use: { ...device, storageState: consentDecided },
            testIgnore: [moderationSetupGlob, moderationSpecGlob]
        }))
    }

    return [
        {
            name: 'setup-moderation',
            testMatch: moderationSetupGlob,
            use: { ...devices['Desktop Chrome'] }
        },
        ...browserDefs.map(({ name, device }) => ({
            name,
            use: { ...device, storageState: consentDecided },
            testIgnore: [moderationSpecGlob, moderationSetupGlob]
        })),
        {
            name: 'chromium-moderation',
            dependencies: ['setup-moderation'],
            testMatch: moderationSpecGlob,
            testIgnore: [moderationSetupGlob],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.auth/moderation.json'
            }
        }
    ]
}

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    webServer: {
        command: 'yarn dev:e2e',
        url: 'http://localhost:4242',
        reuseExistingServer: true,
        timeout: 120000
    },
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI
        ? [
            ['list'],
            ['json', { outputFile: 'results.json' }],
            ['html', { outputFolder: 'playwright-report' }]]
        : 'html',
    use: {
        baseURL,
        trace: 'on-first-retry',
        actionTimeout: 10000,
        navigationTimeout: 30000
    },
    timeout: 60000,
    expect: { timeout: 10000 },
    projects: buildProjects(Boolean(process.env.CI))
})
