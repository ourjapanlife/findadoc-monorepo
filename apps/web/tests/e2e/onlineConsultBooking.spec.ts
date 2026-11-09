import { expect, test, type Page } from '@playwright/test'

import {
    ONLINE_CONSULT_FORM_ID,
    bookPagePath,
    chooseStart,
    confirmAndSubmit,
    expectManageStatus,
    fillOnlineConsultContactStep,
    japanWeekday,
    newPatient,
    offeredStarts,
    readSuccess
} from './booking'

/**
 * A signed-out patient books the seeded showcase clinic on the online consult form (version 4)
 * against the local API: every required field, both uploads, and a payment method. The visit
 * starts as pending payment (§3.1), so the success screen and the manage link say so, and the
 * time is held. This writes a real booking, so it runs in Chromium only.
 */

test.describe.configure({ mode: 'serial' })

// bookingFlow.spec.ts books on japanWeekday(3) and clinicDashboard.spec.ts on japanWeekday(5).
const day = japanWeekday(2)

// A 1x1 transparent PNG and the smallest PDF: enough for the upload checks, which read type and size.
const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
)
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'books real times on the local API; one browser is enough')
})

/** The visit step after the time: Japanese level, consultation language, symptoms, past illnesses. */
async function fillOnlineConsultVisitFields(page: Page): Promise<void> {
    await page.getByTestId('clinic-booking-field-japaneseLevel').selectOption('little')
    await page.getByTestId('clinic-booking-field-consultationLanguage').selectOption('en')
    await page.getByTestId('clinic-booking-field-reason').fill('E2E headache for three days')
    await page.getByTestId('clinic-booking-field-pastIllnesses').fill('E2E none')
}

/** The documents step: insurance type and both files. */
async function fillOnlineConsultDocuments(page: Page): Promise<void> {
    await page.getByTestId('stepper-next').click()
    await expect(page.getByTestId('clinic-booking-field-insuranceType')).toBeVisible()
    await page.getByTestId('clinic-booking-field-insuranceType').selectOption('insuranceCard')
    await page.getByTestId('clinic-booking-field-insuranceDocument').setInputFiles({
        name: 'e2e-insurance.pdf',
        mimeType: 'application/pdf',
        buffer: PDF_BYTES
    })
    await page.getByTestId('clinic-booking-field-selfie').setInputFiles({
        name: 'e2e-selfie.png',
        mimeType: 'image/png',
        buffer: PNG_BYTES
    })
}

/** The payment step: the method, with the §3.1 notice under it. */
async function fillOnlineConsultPayment(page: Page): Promise<void> {
    await page.getByTestId('stepper-next').click()
    await expect(page.getByTestId('clinic-booking-field-paymentMethod')).toBeVisible()
    await page.getByTestId('clinic-booking-field-paymentMethod').selectOption('bankTransfer')
    await expect(page.getByTestId('clinic-booking-hint-paymentMethod')).toContainText('not confirmed yet')
}

test('a patient books the online consult form and the visit waits for payment', async ({ page }) => {
    await page.goto(bookPagePath(day, ONLINE_CONSULT_FORM_ID))
    await fillOnlineConsultContactStep(page, newPatient('Consult'))
    const [start] = await offeredStarts(page, day)
    expect(start, `no open time on ${day}; reset and seed the local database`).toBeTruthy()
    await chooseStart(page, start!)
    await fillOnlineConsultVisitFields(page)
    await fillOnlineConsultDocuments(page)
    await fillOnlineConsultPayment(page)
    await confirmAndSubmit(page)

    const booking = await readSuccess(page, start!)
    await expect(page.getByTestId('clinic-booking-pending-payment')).toContainText('not confirmed yet')

    await expectManageStatus(page, booking.manageUrl, /Pending payment/)

    await page.goto(bookPagePath(day, ONLINE_CONSULT_FORM_ID))
    await fillOnlineConsultContactStep(page, newPatient('ConsultNext'))
    expect(await offeredStarts(page, day)).not.toContain(booking.start)
})
