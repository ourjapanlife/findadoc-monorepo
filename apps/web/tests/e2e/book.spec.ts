import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Booking is offered only to people in Japan (#173). The Book page asks the API
 * first. A visitor elsewhere sees a notice with the clinic's contact details and
 * a link back to the clinic, not the form.
 *
 * Local development and CI have no CloudFront in front of the API, so the real API
 * always says yes. These tests answer the API calls themselves.
 */

const FACILITY_ID = 'c32c316a-a368-499b-abaf-c5c973cb67e5'

function isApiRequest(url: URL): boolean {
    return (url.hostname === '127.0.0.1' && url.port === '4000') || url.hostname === 'api.findadoc.jp'
}

const bookingForm = {
    id: 'findadoc-intake-v1',
    version: 1,
    facilityId: FACILITY_ID,
    clinicSiteId: null,
    clinicSiteSlug: null,
    clinicName: 'Test Clinic',
    themePrimary: null,
    allowedDurations: [30],
    defaultDuration: 30,
    fields: [],
    practitioners: [],
    languages: []
}

const facility = {
    id: FACILITY_ID,
    nameEn: 'Test Clinic',
    nameJa: 'テストクリニック',
    online: false,
    healthcareProfessionalIds: [],
    contact: {
        phone: '03-1234-5678',
        email: 'desk@example.com',
        website: 'https://clinic.example.com',
        googleMapsUrl: '',
        address: { prefectureEn: 'Tokyo', cityEn: 'Minato' }
    }
}

/**
 * `bookingAvailable` is one answer per call, in order; the last one repeats. `'error'`
 * answers that call with a server error.
 */
async function mockBookingApi(page: Page, ...answers: Array<boolean | 'error'>): Promise<void> {
    let availabilityCalls = 0
    await page.route(isApiRequest, async (route: Route) => {
        const query = (route.request().postDataJSON() as { query?: string } | null)?.query ?? ''
        const reply = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })

        if (query.includes('BookingAvailable')) {
            const answer = answers[Math.min(availabilityCalls, answers.length - 1)]
            availabilityCalls += 1
            if (answer === 'error') {
                await route.fulfill({ status: 500, contentType: 'application/json', body: '{"errors":[{"message":"boom"}]}' })
                return
            }
            await reply({ bookingAvailable: answer })
            return
        }
        if (query.includes('query BookingForm')) {
            await reply({ bookingForm })
            return
        }
        if (query.includes('ClinicFacility')) {
            await reply({ facility })
            return
        }
        if (query.includes('AvailableBookingStarts')) {
            await reply({ availableBookingStarts: [] })
            return
        }
        await route.fallback()
    })
}

test('a visitor outside Japan sees the notice and the clinic contact, not the form', async ({ page }) => {
    await mockBookingApi(page, false)
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    const notice = page.getByTestId('clinic-booking-region-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Booking is currently available only to people in Japan')
    await expect(page.getByTestId('clinic-booking-form')).toHaveCount(0)

    const contact = page.getByTestId('clinic-booking-region-contact')
    await expect(contact.getByRole('link', { name: '03-1234-5678' })).toHaveAttribute('href', 'tel:0312345678')
    await expect(contact.getByRole('link', { name: 'desk@example.com' })).toBeVisible()
    await expect(page.getByTestId('clinic-booking-region-clinic-link'))
        .toHaveAttribute('href', `/clinic/tokyo/minato/test-clinic--${FACILITY_ID}`)
})

test('a visitor in Japan gets the form', async ({ page }) => {
    await mockBookingApi(page, true)
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    await expect(page.getByTestId('clinic-booking-form')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-region-notice')).toHaveCount(0)
})

// A failed check is not a yes and not a region refusal (#188).
test('a failed availability check shows a retry, not the form or the region notice', async ({ page }) => {
    await mockBookingApi(page, 'error')
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    await expect(page.getByTestId('clinic-booking-availability-error')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-form')).toHaveCount(0)
    await expect(page.getByTestId('clinic-booking-region-notice')).toHaveCount(0)

    await page.getByTestId('clinic-booking-availability-retry').click()
    await expect(page.getByTestId('clinic-booking-availability-error')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-form')).toHaveCount(0)
})

test('a retry that gets a yes shows the form', async ({ page }) => {
    await mockBookingApi(page, 'error', 'error', true)
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    await page.getByTestId('clinic-booking-availability-retry').click()
    await expect(page.getByTestId('clinic-booking-form')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-availability-error')).toHaveCount(0)
})

test('a retry that gets a no shows the region notice', async ({ page }) => {
    await mockBookingApi(page, 'error', 'error', false)
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    await page.getByTestId('clinic-booking-availability-retry').click()
    await expect(page.getByTestId('clinic-booking-region-notice')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-region-contact').getByRole('link', { name: '03-1234-5678' })).toBeVisible()
    await expect(page.getByTestId('clinic-booking-form')).toHaveCount(0)
})
