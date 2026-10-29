<script setup lang="ts">
import { createError, definePageMeta, navigateTo } from '#imports'
import { useI18n } from 'vue-i18n'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { findadocClinicDashboardUrl } from '~/utils/booking/paths'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { localizedPath } from '~/utils/localePath'

/**
 * `{slug}.findadoc.jp/dashboard` sends staff to Find a Doc `/clinic-dashboard/{facilityId}`.
 * Auth0 keeps its session per origin, so the dashboard lives on one host.
 * On the main site this is a short way to `/clinic-dashboard`.
 */
definePageMeta({
    ssr: false
})

const { locale } = useI18n()
const mode = useClinicLandingMode()
const { host, hostname } = useRequestHost()
const slug = clinicLandingHostSlug(hostname)

if (mode === 'off' || slug === undefined) {
    await navigateTo(localizedPath('/clinic-dashboard', String(locale.value)), { replace: true })
} else {
    const loaded = await fetchBookingForm(slug)
    if (loaded === null || loaded.facilityId === null || loaded.facilityId === undefined) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    await navigateTo(findadocClinicDashboardUrl(loaded.facilityId, host), { redirectCode: 302, external: true })
}
</script>

<template>
    <div />
</template>
