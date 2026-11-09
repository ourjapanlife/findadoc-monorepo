import { expect, test, type Page, type Route } from '@playwright/test'
import { graphqlOperation } from './graphqlRequest'

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
    clinicNameJa: 'テストクリニック',
    themePrimary: null,
    branding: null,
    allowedDurations: [30],
    defaultDuration: 30,
    fields: [],
    practitioners: [],
    languages: []
}

function formField(id: string, type: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        type,
        stepKey: 'contact',
        required: true,
        labelKey: `bookingPage.fields.${id}`,
        label: null,
        placeholderKey: null,
        hintKey: null,
        accept: null,
        maxLength: null,
        maxBytes: null,
        min: null,
        max: null,
        sensitivity: 'STANDARD',
        options: null,
        showWhen: null,
        phoneRegion: null,
        ...extra
    }
}

function selectOptions(fieldId: string, values: string[]) {
    return values.map(value => ({ value, labelKey: `bookingPage.options.${fieldId}.${value}`, label: null }))
}

/** The version 4 online consult fields this spec checks, as the API sends them (spec §1, §2). */
const onlineConsultForm = {
    ...bookingForm,
    id: 'showcase-intake-v1',
    version: 4,
    fields: [
        formField('phone', 'PHONE', { phoneRegion: 'JP', maxLength: 40 }),
        formField('gender', 'SELECT', { options: selectOptions('gender', ['male', 'female', 'selfDescribe']) }),
        formField('genderSelfDescribed', 'TEXT', { showWhen: { fieldId: 'gender', equals: 'selfDescribe', anyOf: null } }),
        formField('backupContactChannel', 'SELECT', {
            required: false,
            options: selectOptions('backupContactChannel', ['line', 'whatsapp', 'messenger'])
        }),
        formField('backupContactHandle', 'TEXT', {
            showWhen: { fieldId: 'backupContactChannel', equals: null, anyOf: ['line', 'whatsapp', 'messenger'] }
        }),
        formField('paymentMethod', 'SELECT', {
            hintKey: 'bookingPage.hints.paymentMethod',
            options: selectOptions('paymentMethod', ['creditCard', 'bankTransfer', 'payPay'])
        })
    ]
}

const facility = {
    id: FACILITY_ID,
    nameEn: 'Test Clinic',
    nameJa: 'テストクリニック',
    online: false,
    healthcareProfessionalIds: [],
    contact: {
        phone: '+81312345678',
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
    await mockBookingApiWithForm(page, bookingForm, ...answers)
}

async function mockBookingApiWithForm(
    page: Page,
    form: typeof bookingForm | typeof onlineConsultForm,
    ...answers: Array<boolean | 'error'>
): Promise<void> {
    let availabilityCalls = 0
    await page.route(isApiRequest, async (route: Route) => {
        const query = graphqlOperation(route.request())?.query ?? ''
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
            await reply({ bookingForm: form })
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
    await expect(contact.getByRole('link', { name: '+81 3-1234-5678' })).toHaveAttribute('href', 'tel:+81312345678')
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

test('the Book page names the clinic in the reader\'s language', async ({ page }) => {
    await mockBookingApi(page, true)
    await page.goto(`/ja-JP/book/${FACILITY_ID}?preview=1`)
    await expect(page.getByTestId('clinic-booking-heading')).toHaveText('テストクリニックの予約')

    await page.goto(`/book/${FACILITY_ID}?preview=1`)
    await expect(page.getByTestId('clinic-booking-heading')).toContainText('Test Clinic')
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

// A server error with GraphQL errors is not retried on its own (#219), so the page load
// makes one call and the retry button makes the next.
test('a retry that gets a yes shows the form', async ({ page }) => {
    await mockBookingApi(page, 'error', true)
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    await page.getByTestId('clinic-booking-availability-retry').click()
    await expect(page.getByTestId('clinic-booking-form')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-availability-error')).toHaveCount(0)
})

test('a retry that gets a no shows the region notice', async ({ page }) => {
    await mockBookingApi(page, 'error', false)
    await page.goto(`/book/${FACILITY_ID}?preview=1`)

    await page.getByTestId('clinic-booking-availability-retry').click()
    await expect(page.getByTestId('clinic-booking-region-notice')).toBeVisible()
    await expect(page.getByTestId('clinic-booking-region-contact').getByRole('link', { name: '+81 3-1234-5678' })).toBeVisible()
    await expect(page.getByTestId('clinic-booking-form')).toHaveCount(0)
})

test.describe('the online consult form', () => {
    test.beforeEach(async ({ page }) => {
        await mockBookingApiWithForm(page, onlineConsultForm, true)
        await page.goto(`/book/${FACILITY_ID}?preview=1&form=showcase-intake-v1`)
        await expect(page.getByTestId('clinic-booking-form')).toBeVisible()
    })

    test('rewrites a Japanese phone as 090-1234-5678 and refuses an overseas one with its own message', async ({ page }) => {
        const phone = page.getByTestId('clinic-booking-field-phone')

        await phone.fill('+81 90 1234 5678')
        await phone.blur()
        await expect(phone).toHaveValue('090-1234-5678')

        await phone.fill('+1 212 555 0100')
        await phone.blur()
        await expect(page.getByText('Enter a Japanese phone number, such as 090-1234-5678')).toBeVisible()
    })

    test('offers Male, Female, and Other, and Other asks for the patient\'s own words', async ({ page }) => {
        const gender = page.getByTestId('clinic-booking-field-gender')
        await expect(gender.locator('option')).toHaveText(['Choose one', 'Male', 'Female', 'Other'])

        await expect(page.getByTestId('clinic-booking-field-genderSelfDescribed')).toHaveCount(0)
        await gender.selectOption('selfDescribe')
        await expect(page.getByTestId('clinic-booking-field-genderSelfDescribed')).toBeVisible()
    })

    test('asks for the backup handle once any app is chosen, and hides it again when none is', async ({ page }) => {
        const channel = page.getByTestId('clinic-booking-field-backupContactChannel')
        const handle = page.getByTestId('clinic-booking-field-backupContactHandle')

        await expect(handle).toHaveCount(0)
        for (const app of ['line', 'whatsapp', 'messenger']) {
            await channel.selectOption(app)
            await expect(handle).toBeVisible()
        }
        await channel.selectOption('')
        await expect(handle).toHaveCount(0)
    })

    test('shows the payment notice under the payment method', async ({ page }) => {
        await expect(page.getByTestId('clinic-booking-hint-paymentMethod'))
            .toHaveText(/Your reservation is not confirmed yet\. It is confirmed once the clinic receives the initial payment\./)
        await expect(page.getByTestId('clinic-booking-field-paymentMethod'))
            .toHaveAttribute('aria-describedby', 'booking-paymentMethod-hint')
    })
})
