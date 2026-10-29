<template>
    <ClinicDashboardGate>
        <div
            class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6"
            data-testid="clinic-dashboard-index"
        >
            <h1 class="text-2xl font-semibold text-primary-text">
                {{ t('clinicDashboard.heading') }}
            </h1>
            <p
                v-if="loading"
                class="text-primary-text-muted"
            >
                {{ t('clinicDashboard.loading') }}
            </p>
            <p
                v-else-if="clinics === null"
                class="field-error"
                role="alert"
            >
                {{ t('clinicDashboard.loadError') }}
            </p>
            <div
                v-else-if="clinics.length === 0"
                class="flex flex-col gap-2"
                data-testid="clinic-dashboard-no-clinics"
            >
                <p>{{ t('clinicDashboard.noClinics') }}</p>
                <p class="text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.noClinicsHelp') }}
                </p>
            </div>
            <ul
                v-else
                class="flex flex-col gap-2"
            >
                <li
                    v-for="clinic in clinics"
                    :key="clinic.facilityId"
                >
                    <NuxtLink
                        :to="dashboardPath(clinic.facilityId)"
                        class="flex items-center justify-between rounded-lg border border-accent-bg
                        bg-secondary-bg p-4 hover:border-primary"
                    >
                        <span class="flex items-center gap-2 font-medium">
                            {{ clinic.clinicName }}
                            <ClinicRequestCountBadge :count="clinic.requestedCount" />
                        </span>
                        <span class="text-sm text-primary-text-muted">
                            {{ clinic.role === ClinicMemberRole.Owner
                                ? t('clinicDashboard.roles.owner')
                                : t('clinicDashboard.roles.staff') }}
                        </span>
                    </NuxtLink>
                </li>
            </ul>
        </div>
    </ClinicDashboardGate>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClinicMemberRole, type BookingClinic } from '@findadoc/graphql'
import { definePageMeta, navigateTo, useHead } from '#imports'
import ClinicRequestCountBadge from '~/components/booking/ClinicRequestCountBadge.vue'
import { useAuthStore } from '~/stores/authStore'
import { useMyBookingClinicsStore } from '~/stores/myBookingClinicsStore'
import { localizedPath } from '~/utils/localePath'
import { formatPageTitle } from '~/utils/site'

/**
 * `/clinic-dashboard`: the clinics this account belongs to. Loading it claims
 * any pending invite for the account's verified email. One clinic opens directly.
 */
definePageMeta({
    ssr: false
})

const { t, locale } = useI18n()
const authStore = useAuthStore()
const myBookingClinicsStore = useMyBookingClinicsStore()
const clinics = ref<BookingClinic[] | null>(null)
const loading = ref(true)

function dashboardPath(facilityId: string): string {
    return localizedPath(`/clinic-dashboard/${facilityId}`, String(locale.value))
}

async function load(): Promise<void> {
    loading.value = true
    // Refresh, so the account menu count matches this list.
    clinics.value = await myBookingClinicsStore.refresh()
    loading.value = false
    if (clinics.value?.length === 1) {
        await navigateTo(dashboardPath(clinics.value[0]!.facilityId), { replace: true })
    }
}

watch(() => authStore.isLoggedIn, isLoggedIn => {
    if (isLoggedIn) {
        void load()
    }
}, { immediate: true })

useHead(() => ({
    title: formatPageTitle(t('clinicDashboard.heading')),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))
</script>
