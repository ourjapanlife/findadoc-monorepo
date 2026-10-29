<script setup lang="ts">
import { createError, definePageMeta, navigateTo, useRoute } from '#imports'
import { useI18n } from 'vue-i18n'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { bookingQueryFromRoute, bookingPreviewFromRoute, findadocBookUrl } from '~/utils/booking/paths'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'

/**
 * Clinic hostname bounce: `{slug}.findadoc.jp/book` sends the visitor to
 * Find a Doc `/book/{facilityId}` with the same query params.
 */
definePageMeta({
    layout: 'clinic-landing',
    ssr: false,
    middleware: ['online-clinic-preview']
})

const route = useRoute()
const { locale } = useI18n()
const mode = useClinicLandingMode()
const { host, hostname } = useRequestHost()
const slug = clinicLandingHostSlug(hostname)

if (mode === 'off' || slug === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const loaded = await fetchBookingForm(slug)
if (loaded === null) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const clinicId = loaded.facilityId ?? loaded.clinicSiteId
if (clinicId === null || clinicId === undefined || clinicId === '') {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

const target = findadocBookUrl(clinicId, {
    localeCode: String(locale.value),
    requestHost: host,
    query: bookingQueryFromRoute(route.query as Record<string, unknown>),
    // The middleware let this visitor through on the clinic host. The cookie does not
    // cross hosts, so in preview mode the Find a Doc Book page gets `?preview=1`.
    preview: mode === 'preview' ? '1' : bookingPreviewFromRoute(route.query as Record<string, unknown>)
})
await navigateTo(target, { redirectCode: 302, external: true })
</script>
