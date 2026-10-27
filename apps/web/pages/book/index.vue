<template>
    <div
        v-if="!ready"
        class="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-16"
        data-testid="clinic-booking-auth-gate"
    >
        <p class="text-primary-text-muted">
            {{ t('bookingPage.authRequired') }}
        </p>
    </div>
    <ClinicBookingForm
        v-else-if="form !== null"
        :form="form"
    />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { createError, definePageMeta, useHead } from '#imports'
import { useI18n } from 'vue-i18n'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { useBookingAuthGate } from '~/composables/useBookingAuthGate'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { formatPageTitle } from '~/utils/site'
import type { BookingForm } from '@findadoc/graphql'

/**
 * Booking on a clinic hostname: `{slug}.findadoc.jp/book`.
 * The clinic is the host. Main-site `/book/{id}` redirects here.
 * Auth-gated for now — booking GraphQL rejects anonymous callers.
 */
definePageMeta({
    layout: 'clinic-landing',
    ssr: false
})

const { t, locale } = useI18n()
const mode = useClinicLandingMode()
const { hostname } = useRequestHost()
const { ready } = useBookingAuthGate()
const form = ref<BookingForm | null>(null)

const slug = clinicLandingHostSlug(hostname)
if (mode === 'off' || slug === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

async function loadForm(): Promise<void> {
    if (!ready.value || slug === undefined) {
        return
    }
    const loaded = await fetchBookingForm(slug)
    if (loaded === null) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    form.value = loaded
}

watch(ready, value => {
    if (value) {
        void loadForm()
    }
}, { immediate: true })

useHead(() => ({
    title: formatPageTitle(t('bookingPage.documentTitle', {
        clinic: form.value?.clinicName ?? slug
    })),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))

void locale
</script>
