<template>
    <div
        v-if="!ready || (form === null && !shouldRedirect)"
        class="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-16"
        data-testid="clinic-booking-auth-gate"
    >
        <p class="text-primary-text-muted">
            {{ t('bookingPage.authRequired') }}
        </p>
    </div>
    <ClinicBookingForm
        v-else-if="form !== null && !shouldRedirect"
        :form="form"
    />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createError, definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useI18n } from 'vue-i18n'
import type { BookingForm } from '@findadoc/graphql'
import ClinicBookingForm from '~/components/booking/ClinicBookingForm.vue'
import { useBookingAuthGate } from '~/composables/useBookingAuthGate'
import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { fetchBookingForm } from '~/utils/booking/formQuery'
import { clinicBookUrl } from '~/utils/booking/paths'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { formatPageTitle } from '~/utils/site'

/**
 * Main-site alias: `/book/{clinic-id-or-slug}`.
 * On production and when a clinic host can be opened, this redirects to the
 * subdomain `/book`. Local apex keeps the form so `/book/{id}` still works.
 * Auth-gated for now — booking GraphQL rejects anonymous callers.
 */
definePageMeta({
    layout: 'clinic-landing',
    ssr: false
})

const route = useRoute()
const { t, locale } = useI18n()
const mode = useClinicLandingMode()
const { host, hostname } = useRequestHost()
const { ready } = useBookingAuthGate()
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
    if (!ready.value || clinicId === '') {
        return
    }
    const loaded = await fetchBookingForm(clinicId)
    if (loaded === null) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    }
    form.value = loaded
    if (shouldRedirect.value) {
        const target = clinicBookUrl(loaded.clinicSiteSlug, {
            localeCode: String(locale.value),
            requestHost: host
        })
        await navigateTo(target, { redirectCode: 302, external: true })
    }
}

watch(ready, value => {
    if (value) {
        void loadForm()
    }
}, { immediate: true })

useHead(() => ({
    title: formatPageTitle(t('bookingPage.documentTitle', {
        clinic: form.value?.clinicName ?? clinicId
    })),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))
</script>
