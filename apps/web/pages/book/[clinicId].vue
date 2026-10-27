<template>
    <ClinicBookingForm
        v-if="form !== null && !shouldRedirect"
        :form="form"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { createError, definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useI18n } from 'vue-i18n'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { clinicBookUrl } from '~/utils/booking/paths'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { formatPageTitle } from '~/utils/site'

/**
 * Main-site alias: `/book/{clinic-id-or-slug}`.
 * On production and when a clinic host can be opened, this redirects to the
 * subdomain `/book`. Local apex keeps the form so `/book/{id}` still works.
 */
definePageMeta({
    layout: 'clinic-landing'
})

const route = useRoute()
const { t, locale } = useI18n()
const mode = useClinicLandingMode()
const { host, hostname } = useRequestHost()

if (mode === 'off') {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const clinicId = String(route.params.clinicId ?? '')
const form = await fetchBookingForm(clinicId)
if (form === null) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const hostSlug = clinicLandingHostSlug(hostname)
const onMatchingClinicHost = hostSlug !== undefined && hostSlug === form.clinicSiteSlug
const shouldRedirect = computed(() => {
    if (onMatchingClinicHost) {
        return false
    }
    // Clinic hostname that is not this clinic: bounce to the right host.
    if (hostSlug !== undefined) {
        return true
    }
    // Apex / www: always send people to the clinic subdomain booking URL.
    return true
})

if (shouldRedirect.value) {
    const target = clinicBookUrl(form.clinicSiteSlug, {
        localeCode: String(locale.value),
        requestHost: host
    })
    await navigateTo(target, { redirectCode: 302, external: true })
}

useHead(() => ({
    title: formatPageTitle(t('bookingPage.documentTitle', { clinic: form.clinicName })),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))
</script>
