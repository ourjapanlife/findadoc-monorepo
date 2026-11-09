import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { consentDeniedCookie } from './fixtures'

/**
 * Helpers for the specs that book the seeded showcase clinic against the local API
 * (bookingFlow.spec.ts, clinicDashboard.spec.ts, onlineConsultBooking.spec.ts). They write
 * real rows, so every patient gets a new email and name, and each spec books on its own
 * weekday so they never race for the same time.
 */

export const SHOWCASE_FACILITY_ID = 'c32c316a-a368-499b-abaf-c5c973cb67e5'
export const SHOWCASE_SLUG = 'multilingual-online-clinic'

// The seed offers this shorter form too. It has no uploads, so no storage is needed.
const STANDARD_FORM_ID = 'findadoc-intake-v1'
// The online consult form (version 4): Japanese phone, uploads, and a payment step.
export const ONLINE_CONSULT_FORM_ID = 'showcase-intake-v1'
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type Patient = { name: string, email: string }

/** A patient no earlier run has used, so the open-request limit per email never applies. */
export function newPatient(label: string): Patient {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    return { name: `E2E ${label} ${id}`, email: `e2e-${label.toLowerCase()}-${id}@example.com` }
}

/**
 * The nth weekday after today in Japan, as YYYY-MM-DD. The seed opens weekdays
 * 09:00–12:00 and 13:00–17:00 JST for the next 14 days.
 */
export function japanWeekday(n: number): string {
    const day = new Date(Date.now() + JST_OFFSET_MS)
    day.setUTCHours(0, 0, 0, 0)
    let found = 0
    while (found < n) {
        day.setUTCDate(day.getUTCDate() + 1)
        const weekday = day.getUTCDay()
        if (weekday !== 0 && weekday !== 6) {
            found += 1
        }
    }
    return day.toISOString().slice(0, 10)
}

/** A signed-out visitor with the cookie choice already made, like every other spec. */
export async function newPatientContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
    const hostname = new URL(baseURL ?? 'http://localhost:4242').hostname
    return browser.newContext({ storageState: { cookies: [consentDeniedCookie(hostname)], origins: [] } })
}

/**
 * The Book page with `formId` (the standard form by default), opened on the week of `day`.
 * `?preview=1` passes the preview gate.
 */
export function bookPagePath(day: string, formId: string = STANDARD_FORM_ID): string {
    // Noon JST is the lunch break, so this only picks the week and never a time.
    return `/book/${SHOWCASE_FACILITY_ID}?preview=1&form=${formId}&start=${day}T03:00:00.000Z`
}

/** The open starts the Book page offers on `day`, once the picker has loaded. */
export async function offeredStarts(page: Page, day: string): Promise<string[]> {
    const dayButton = page.getByTestId(`booking-day-${day}`)
    await expect(dayButton).toBeVisible()
    await expect(page.getByTestId('booking-slot-picker').getByRole('radiogroup')).toHaveAttribute('aria-busy', 'false')
    if (await dayButton.isDisabled()) {
        return []
    }
    await dayButton.click()
    const slots = page.getByTestId('booking-slot-picker').locator('button[data-testid^="booking-slot-2"]')
    await expect(slots.first()).toBeVisible()
    const ids = await slots.evaluateAll(buttons => buttons.map(button => button.getAttribute('data-testid') ?? ''))
    return ids.map(id => id.slice('booking-slot-'.length))
}

/** The email, phone, and name every form asks for on its contact step. */
async function fillSharedContactFields(page: Page, patient: Patient): Promise<void> {
    await expect(page.getByTestId('clinic-booking-form')).toBeVisible()
    await page.getByTestId('clinic-booking-field-email').fill(patient.email)
    await page.getByTestId('clinic-booking-field-phone').fill('090-1234-5678')
    await page.getByTestId('clinic-booking-field-fullName').fill(patient.name)
}

/** Moves from the contact step to the visit step, where the times are. */
async function nextToVisitStep(page: Page): Promise<void> {
    await page.getByTestId('stepper-next').click()
    await expect(page.getByTestId('booking-slot-picker')).toBeVisible()
}

/** Fills the contact step and moves on to the visit step, where the times are. */
export async function fillContactStep(page: Page, patient: Patient): Promise<void> {
    await fillSharedContactFields(page, patient)
    await nextToVisitStep(page)
}

/**
 * Fills the online consult contact step (version 4) and moves on to the visit step. The date
 * of birth, gender, and address are required there; the backup contact app stays empty.
 */
export async function fillOnlineConsultContactStep(page: Page, patient: Patient): Promise<void> {
    await fillSharedContactFields(page, patient)
    await page.getByTestId('clinic-booking-field-dateOfBirth').fill('1990-04-01')
    await page.getByTestId('clinic-booking-field-gender').selectOption('female')
    await page.getByTestId('clinic-booking-field-addressInJapan').fill('1-2-3 Example, Minato-ku, Tokyo')
    await nextToVisitStep(page)
}

/** Chooses `start` on the visit step. */
export async function chooseStart(page: Page, start: string): Promise<void> {
    await page.getByTestId(`booking-slot-${start}`).click()
    await expect(page.getByTestId(`booking-slot-${start}`)).toHaveAttribute('aria-pressed', 'true')
}

/** Ticks both boxes on the last step and sends the request. */
export async function confirmAndSubmit(page: Page): Promise<void> {
    await page.getByTestId('clinic-booking-confirm-in-japan').check()
    await page.getByTestId('clinic-booking-health-consent').check()
    await page.getByTestId('clinic-booking-submit').click()
}

/** Chooses `start` on the visit step, writes a reason, ticks both boxes, and sends the request. */
export async function chooseStartAndSubmit(page: Page, start: string): Promise<void> {
    await chooseStart(page, start)
    await page.getByTestId('clinic-booking-field-reason').fill('E2E check-up')
    await confirmAndSubmit(page)
}

export type Booking = { start: string, submissionId: string, manageUrl: string }

/** Books the first open time on `day` and returns the request the success screen shows. */
export async function bookFirstOpenStart(page: Page, day: string, patient: Patient): Promise<Booking> {
    await page.goto(bookPagePath(day))
    await fillContactStep(page, patient)
    const [start] = await offeredStarts(page, day)
    expect(start, `no open time on ${day}; reset and seed the local database`).toBeTruthy()
    await chooseStartAndSubmit(page, start!)
    return readSuccess(page, start!)
}

/** The reference and the manage link on the success screen. */
export async function readSuccess(page: Page, start: string): Promise<Booking> {
    const success = page.getByTestId('clinic-booking-success')
    await expect(success).toBeVisible()
    const submissionId = (await success.textContent())?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0]
    expect(submissionId, 'the success screen shows the reference').toBeTruthy()
    const manageLink = page.getByTestId('clinic-booking-manage-link')
    await expect(manageLink).toBeVisible()
    const href = await manageLink.getAttribute('href')
    expect(href).toMatch(/\/book\/manage#.+/)
    return { start, submissionId: submissionId!, manageUrl: href! }
}

/** Opens the patient's manage link and checks the status it shows. */
export async function expectManageStatus(page: Page, manageUrl: string, status: RegExp): Promise<void> {
    await page.goto(manageUrl)
    await expect(page.getByTestId('patient-booking-status')).toHaveText(status)
}

/** Opens the patient's manage link and cancels with `reason`. */
export async function cancelFromManageLink(page: Page, manageUrl: string, reason: string): Promise<void> {
    await page.goto(manageUrl)
    const manage = page.getByTestId('patient-booking-manage')
    await expect(page.getByTestId('patient-booking-status')).toBeVisible()
    await manage.getByRole('textbox').fill(reason)
    await page.getByTestId('patient-booking-cancel').click()
    await page.getByTestId('patient-booking-confirm-cancel').click()
    await expect(page.getByTestId('patient-booking-status')).toHaveText(/Cancelled/)
    await expect(page.getByTestId('patient-booking-cancel')).toHaveCount(0)
}
