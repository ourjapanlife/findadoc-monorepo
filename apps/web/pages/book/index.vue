<template>
    <ClinicBookingForm
        v-if="form !== null"
        :form="form"
    />
</template>

<script setup lang="ts">
import { createError, definePageMeta, useHead } from '#imports'
import { useI18n } from 'vue-i18n'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { formatPageTitle } from '~/utils/site'

/**
 * Booking on a clinic hostname: `{slug}.findadoc.jp/book`.
 * The clinic is the host. Main-site `/book/{id}` redirects here.
 */
definePageMeta({
    layout: 'clinic-landing'
})

const { t, locale } = useI18n()
const mode = useClinicLandingMode()
const { hostname } = useRequestHost()

const slug = clinicLandingHostSlug(hostname)
if (mode === 'off' || slug === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const form = await fetchBookingForm(slug)
if (form === null) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

useHead(() => ({
    title: formatPageTitle(t('bookingPage.documentTitle', { clinic: form.clinicName })),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))

void locale
</script>
