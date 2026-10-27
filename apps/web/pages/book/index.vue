<template>
    <ClinicBookingForm
        v-if="form !== null"
        :form="form"
    />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createError, definePageMeta, useHead } from '#imports'
import { useI18n } from 'vue-i18n'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { formatPageTitle } from '~/utils/site'
import type { BookingForm } from '@findadoc/graphql'

/**
 * Booking on a clinic hostname: `{slug}.findadoc.jp/book`.
 * The clinic is the host. Main-site `/book/{id}` redirects here.
 * The form is public. Open times come from the clinic calendar.
 */
definePageMeta({
    layout: 'clinic-landing',
    ssr: false
})

const { t, locale } = useI18n()
const mode = useClinicLandingMode()
const { hostname } = useRequestHost()
const form = ref<BookingForm | null>(null)

const slug = clinicLandingHostSlug(hostname)
if (mode === 'off' || slug === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const loaded = await fetchBookingForm(slug)
if (loaded === null) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}
form.value = loaded

useHead(() => ({
    title: formatPageTitle(t('bookingPage.documentTitle', {
        clinic: form.value?.clinicName ?? slug
    })),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))

void locale
</script>
