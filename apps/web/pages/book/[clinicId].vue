<template>
    <ClinicBookingForm
        v-if="form !== null && bookingAvailable === true"
        :form="form"
        :query="bookingQuery"
    />
    <div
        v-else-if="form !== null"
        class="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-10 landscape:px-12"
    >
        <div class="flex items-start justify-between gap-4">
            <header class="flex min-w-0 flex-col gap-3">
                <p class="eyebrow">
                    {{ t('bookingPage.eyebrow') }}
                </p>
                <h1
                    class="page-title-sm"
                    data-testid="clinic-booking-heading"
                >
                    {{ t('bookingPage.heading', { clinic: form.clinicName }) }}
                </h1>
            </header>
            <LocaleSelector class="shrink-0" />
        </div>
        <BookingRegionNotice
            v-if="bookingAvailable === false"
            :form="form"
        />
        <div
            v-else
            data-testid="clinic-booking-availability-error"
            class="card flex flex-col gap-4 p-6"
            role="alert"
        >
            <h2 class="text-lg font-semibold">
                {{ t('bookingPage.availabilityError.heading') }}
            </h2>
            <p class="text-primary-text-muted">
                {{ t('bookingPage.availabilityError.body') }}
            </p>
            <button
                type="button"
                class="btn btn-primary self-start"
                data-testid="clinic-booking-availability-retry"
                :disabled="checkingAvailability"
                @click="retryAvailability"
            >
                {{ t(checkingAvailability ? 'bookingPage.availabilityError.checking' : 'bookingPage.availabilityError.retry') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createError, definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useI18n } from 'vue-i18n'
import type { BookingForm } from '@findadoc/graphql'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import BookingRegionNotice from '~/components/booking/BookingRegionNotice.vue'
import { fetchBookingAvailable, fetchBookingForm } from '~/utils/booking/formQuery'
import { bookingClinicPath, bookingQueryFromRoute } from '~/utils/booking/paths'
import { formatPageTitle } from '~/utils/site'

/**
 * Find a Doc Book surface: `/book/{facility-id}`. Behind the same preview cookie as the
 * clinic landings: without `?preview=1` (or the cookie it sets) the page is a 404.
 * The patient's manage link (`/book/manage`) is not gated, so cancelling always works.
 * Also accepts a clinic site id or slug, then replaces the path with the facility id.
 * A hosted clinic page or subdomain is not required.
 * Booking is offered only to people in Japan (#173). The API says whether this visitor
 * may book, and a visitor elsewhere sees a notice with the clinic's own contact details.
 * When that call fails there is no answer yet (#188): the page shows neither the form nor
 * the region notice, only a retry.
 */
definePageMeta({
    ssr: false,
    middleware: ['online-clinic-preview']
})

const route = useRoute()
const { t, locale } = useI18n()
const form = ref<BookingForm | null>(null)
const bookingAvailable = ref<boolean | null>(null)
const checkingAvailability = ref(false)
const clinicId = String(route.params.clinicId ?? '')
const bookingQuery = bookingQueryFromRoute(route.query as Record<string, unknown>)

async function loadForm(): Promise<void> {
    if (clinicId === '') {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    const [loaded, available] = await Promise.all([
        fetchBookingForm(clinicId, bookingQuery.form),
        fetchBookingAvailable()
    ])
    if (loaded === null) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    form.value = loaded
    bookingAvailable.value = available
    const canonicalId = loaded.facilityId ?? loaded.clinicSiteId
    if (canonicalId !== null && canonicalId !== undefined && canonicalId !== clinicId) {
        await navigateTo(
            bookingClinicPath(canonicalId, String(locale.value), bookingQuery),
            { redirectCode: 302, replace: true }
        )
    }
}

async function retryAvailability(): Promise<void> {
    checkingAvailability.value = true
    try {
        bookingAvailable.value = await fetchBookingAvailable()
    } finally {
        checkingAvailability.value = false
    }
}

await loadForm()

useHead(() => ({
    title: formatPageTitle(t('bookingPage.documentTitle', {
        clinic: form.value?.clinicName ?? clinicId
    })),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))
</script>
