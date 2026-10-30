import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import {
    SHOWCASE_FACILITY_ID,
    bookFirstOpenStart,
    bookPagePath,
    cancelFromManageLink,
    fillContactStep,
    japanWeekday,
    newPatient,
    newPatientContext,
    offeredStarts,
    type Booking,
    type Patient
} from './booking'

/**
 * The clinic side of booking (#167): a request shows as Requested, the clinic confirms
 * or declines it, the calendar shows it, and a patient's cancel reaches the dashboard.
 * Runs in the signed-in project. The Auth0 test user is made an owner of the showcase
 * clinic on the local database first, as a claimed invite would. Moderators get no
 * booking access (booking-access.md), so the moderation role alone would not do.
 */

const STORAGE_STATE = 'playwright/.auth/moderation.json'
const dashboardPath = `/clinic-dashboard/${SHOWCASE_FACILITY_ID}`

// bookingFlow.spec.ts books on another weekday.
const day = japanWeekday(5)

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
    // Node runs the server script itself. A shell would split the `|` in an Auth0 sub.
    const owner = spawnSync(
        process.execPath,
        ['--loader', 'ts-node/esm', 'scripts/e2e/clinicOwner.ts', signedInSub(), SHOWCASE_FACILITY_ID],
        { cwd: resolve('../server'), encoding: 'utf8' }
    )
    expect(owner.status, `e2e:clinic-owner failed:\n${owner.stdout}\n${owner.stderr}`).toBe(0)
})

test('a request shows as Requested, the clinic confirms it, and the calendar shows it', async ({
    page,
    browser,
    baseURL
}, testInfo) => {
    const patient = newPatient('Confirm')
    const booking = await bookAsPatient(browser, baseURL, patient)

    await page.goto(`${dashboardPath}?tab=requests`)
    await expect(page.getByTestId(`clinic-booking-row-${booking.submissionId}`)).toBeVisible()
    await page.getByTestId(`clinic-booking-row-${booking.submissionId}`).click()

    const status = page.getByTestId('booking-appointment-status')
    await expect(status).toContainText('Requested')
    await page.getByTestId('booking-action-confirmed').click()
    await expect(status).toContainText('Confirmed')

    await page.goto(`${dashboardPath}?tab=calendar`)
    await showWeekOf(page, day)
    await expect(calendarAppointment(page, patient)).toBeVisible()
    await expect(calendarAppointment(page, patient)).toContainText('Confirmed')

    for (const tab of ['requests', 'calendar', 'settings', 'team'] as const) {
        await attachTab(page, tab, testInfo)
    }
})

test('a patient cancels with a reason, the clinic sees it, and the time is offered again', async ({ page, browser, baseURL }) => {
    const patient = newPatient('PatientCancel')
    const booking = await bookAsPatient(browser, baseURL, patient)

    const patientContext = await newPatientContext(browser, baseURL)
    try {
        await cancelFromManageLink(await patientContext.newPage(), booking.manageUrl, 'E2E: feeling better')
    } finally {
        await patientContext.close()
    }

    await page.goto(`${dashboardPath}?tab=requests&booking=${booking.submissionId}`)
    const status = page.getByTestId('booking-appointment-status')
    await expect(status).toContainText('Cancelled')
    await expect(status).toContainText('Cancelled by the patient')
    await expect(status).toContainText('E2E: feeling better')
    await expect(page.locator('[data-testid^="booking-action-"]')).toHaveCount(0)

    expect(await startsOfferedToANewPatient(browser, baseURL)).toContain(booking.start)
})

test('the clinic declines a request with a note, and the time is offered again', async ({ page, browser, baseURL }) => {
    const booking = await bookAsPatient(browser, baseURL, newPatient('Decline'))
    expect(await startsOfferedToANewPatient(browser, baseURL)).not.toContain(booking.start)

    await page.goto(`${dashboardPath}?tab=requests&booking=${booking.submissionId}`)
    const status = page.getByTestId('booking-appointment-status')
    await expect(status).toContainText('Requested')
    await page.getByTestId('booking-status-reason').fill('E2E: fully booked that morning')
    await page.getByTestId('booking-action-declined').click()
    await expect(status).toContainText('Declined')
    await expect(status).toContainText('E2E: fully booked that morning')

    expect(await startsOfferedToANewPatient(browser, baseURL)).toContain(booking.start)
})

/** The `sub` of the Auth0 user the setup project signed in. */
function signedInSub(): string {
    const state = JSON.parse(readFileSync(STORAGE_STATE, 'utf8')) as { cookies: Array<{ name: string, value: string }> }
    const token = state.cookies.find(cookie => cookie.name === 'auth_token')?.value
    expect(token, `no auth_token cookie in ${STORAGE_STATE}`).toBeTruthy()
    const payload = JSON.parse(Buffer.from(token!.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: string }
    expect(payload.sub, 'the access token has a sub').toBeTruthy()
    return payload.sub!
}

async function bookAsPatient(
    browser: Parameters<typeof newPatientContext>[0],
    baseURL: string | undefined,
    patient: Patient
): Promise<Booking> {
    const context = await newPatientContext(browser, baseURL)
    try {
        return await bookFirstOpenStart(await context.newPage(), day, patient)
    } finally {
        await context.close()
    }
}

async function startsOfferedToANewPatient(
    browser: Parameters<typeof newPatientContext>[0],
    baseURL: string | undefined
): Promise<string[]> {
    const context = await newPatientContext(browser, baseURL)
    try {
        const page = await context.newPage()
        await page.goto(bookPagePath(day))
        await fillContactStep(page, newPatient('Look'))
        return await offeredStarts(page, day)
    } finally {
        await context.close()
    }
}

function calendarAppointment(page: Page, patient: Patient) {
    return page.locator('.clinic-calendar-appointment').filter({ hasText: patient.name })
}

/** The calendar opens on this week in Japan, Sunday first. Step forward to the week of `dateKey`. */
async function showWeekOf(page: Page, dateKey: string): Promise<void> {
    const sundayOf = (key: string) => {
        const date = new Date(`${key}T00:00:00.000Z`)
        return date.getTime() - date.getUTCDay() * 24 * 60 * 60 * 1000
    }
    const todayKey = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const weeksAhead = Math.round((sundayOf(dateKey) - sundayOf(todayKey)) / (7 * 24 * 60 * 60 * 1000))

    await expect(page.getByTestId('clinic-availability-calendar')).toBeVisible()
    for (let step = 0; step < weeksAhead; step += 1) {
        await page.locator('.fc-next-button').click()
    }
}

async function attachTab(page: Page, tab: string, testInfo: TestInfo): Promise<void> {
    await page.goto(`${dashboardPath}?tab=${tab}`)
    await expect(page.getByTestId(`clinic-dashboard-tab-${tab}`)).toHaveAttribute('aria-current', 'page')
    const content = {
        requests: 'clinic-booking-requests',
        calendar: 'clinic-availability-calendar',
        settings: 'clinic-settings-panel',
        team: 'clinic-team-panel'
    }[tab]
    await expect(page.getByTestId(content ?? '')).toBeVisible()
    await testInfo.attach(`clinic-dashboard-${tab}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
    })
}
