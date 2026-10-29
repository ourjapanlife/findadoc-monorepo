<template>
    <ClinicBookingForm
        v-if="form !== null"
        :form="form"
        :query="bookingQuery"
    />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createError, definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useI18n } from 'vue-i18n'
import type { BookingForm } from '@findadoc/graphql'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { bookingClinicPath, bookingQueryFromRoute } from '~/utils/booking/paths'
import { formatPageTitle } from '~/utils/site'

/**
 * Find a Doc Book surface: `/book/{facility-id}`.
 * Also accepts a clinic site id or slug, then replaces the path with the facility id.
 * A hosted clinic page or subdomain is not required.
 */
definePageMeta({
    ssr: false
})

const route = useRoute()
const { t, locale } = useI18n()
const form = ref<BookingForm | null>(null)
const clinicId = String(route.params.clinicId ?? '')
const bookingQuery = bookingQueryFromRoute(route.query as Record<string, unknown>)

async function loadForm(): Promise<void> {
    if (clinicId === '') {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    const loaded = await fetchBookingForm(clinicId, bookingQuery.form)
    if (loaded === null) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    form.value = loaded
    const canonicalId = loaded.facilityId ?? loaded.clinicSiteId
    if (canonicalId !== null && canonicalId !== undefined && canonicalId !== clinicId) {
        await navigateTo(
            bookingClinicPath(canonicalId, String(locale.value), bookingQuery),
            { redirectCode: 302, replace: true }
        )
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
