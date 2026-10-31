import { expect, test } from '@playwright/test'

import {
    SHOWCASE_FACILITY_ID,
    SHOWCASE_SLUG,
    bookFirstOpenStart,
    bookPagePath,
    cancelFromManageLink,
    chooseStartAndSubmit,
    fillContactStep,
    japanWeekday,
    newPatient,
    newPatientContext,
    offeredStarts,
    readSuccess
} from './booking'

/**
 * A signed-out patient books the seeded showcase clinic against the local API, cancels from
 * the manage link, and a second patient cannot take a time that is already held (#167).
 * The clinic side is clinicDashboard.spec.ts. These write real bookings, so they run
 * one after another in Chromium only.
 */

test.describe.configure({ mode: 'serial' })

// clinicDashboard.spec.ts books on another weekday.
const day = japanWeekday(3)

test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'books real times on the local API; one browser is enough')
})

test('the clinic subdomain Book button opens the Book page on Find a Doc', async ({ page, baseURL }) => {
    const site = new URL(baseURL ?? 'http://localhost:4242')
    await page.goto(`${site.protocol}//${SHOWCASE_SLUG}.localhost:${site.port}/?preview=1`)
    await page.getByTestId('clinic-landing-book').click()

    await expect(page).toHaveURL(new RegExp(`^${site.protocol}//localhost:${site.port}/book/${SHOWCASE_FACILITY_ID}\\?`))
    await expect(page.getByTestId('clinic-booking-heading')).toBeVisible()
})

test('a patient books, sees the manage link, and the time is no longer offered', async ({ page }) => {
    const booking = await bookFirstOpenStart(page, day, newPatient('Book'))

    await page.goto(bookPagePath(day))
    await fillContactStep(page, newPatient('Next'))
    expect(await offeredStarts(page, day)).not.toContain(booking.start)
})

test('a patient cancels from the manage link with a reason, and the time is offered again', async ({ page }) => {
    const booking = await bookFirstOpenStart(page, day, newPatient('Cancel'))

    await cancelFromManageLink(page, booking.manageUrl, 'E2E: plans changed')

    await page.goto(bookPagePath(day))
    await fillContactStep(page, newPatient('After'))
    expect(await offeredStarts(page, day)).toContain(booking.start)
})

test('a second patient cannot book a time another patient just took', async ({ browser, baseURL }) => {
    const firstContext = await newPatientContext(browser, baseURL)
    const secondContext = await newPatientContext(browser, baseURL)
    try {
        const first = await firstContext.newPage()
        const second = await secondContext.newPage()

        // Both see the same open time before either sends.
        for (const [page, label] of [[first, 'First'], [second, 'Second']] as const) {
            await page.goto(bookPagePath(day))
            await fillContactStep(page, newPatient(label))
        }
        const [start] = await offeredStarts(first, day)
        expect(start).toBeTruthy()
        expect(await offeredStarts(second, day)).toContain(start)

        await chooseStartAndSubmit(first, start!)
        await readSuccess(first, start!)

        await chooseStartAndSubmit(second, start!)
        await expect(second.getByTestId('clinic-booking-form-error')).toBeVisible()
        await expect(second.getByTestId('clinic-booking-success')).toHaveCount(0)
    } finally {
        await firstContext.close()
        await secondContext.close()
    }
})
