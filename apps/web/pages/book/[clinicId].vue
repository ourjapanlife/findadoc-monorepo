<template>
    <ClinicBookingForm
        v-if="form !== null && !shouldRedirect"
        :form="form"
    />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createError, definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useI18n } from 'vue-i18n'
import type { BookingForm } from '@findadoc/graphql'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { clinicBookUrl } from '~/utils/booking/paths'
import { clinicLandingHostSlug, clinicLandingPreviewFlag } from '~/utils/clinicLanding'
import { formatPageTitle } from '~/utils/site'

/**
 * Main-site alias: `/book/{clinic-id-or-slug}`.
 * On production and when a clinic host can be opened, this redirects to the
 * subdomain `/book`. Local apex keeps the form so `/book/{id}` still works.
 * The form is public. Open times come from the clinic calendar.
 */
definePageMeta({
    layout: 'clinic-landing',
    ssr: false
})

const route = useRoute()
const { t, locale } = useI18n()
const mode = useClinicLandingMode()
const { host, hostname } = useRequestHost()
const form = ref<BookingForm | null>(null)

if (mode === 'off') {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const clinicId = String(route.params.clinicId ?? '')
const hostSlug = clinicLandingHostSlug(hostname)

const shouldRedirect = computed(() => {
    if (form.value === null) {
        return false
    }
    const onMatchingClinicHost = hostSlug !== undefined && hostSlug === form.value.clinicSiteSlug
    if (onMatchingClinicHost) {
        return false
    }
    return true
})

async function loadForm(): Promise<void> {
    if (clinicId === '') {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    const loaded = await fetchBookingForm(clinicId)
    if (loaded === null) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    form.value = loaded
    if (shouldRedirect.value) {
        const target = clinicBookUrl(loaded.clinicSiteSlug, {
            localeCode: String(locale.value),
            requestHost: host,
            preview: clinicLandingPreviewFlag(route.query.preview)
        })
        await navigateTo(target, { redirectCode: 302, external: true })
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
