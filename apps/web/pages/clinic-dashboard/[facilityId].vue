<template>
    <ClinicDashboardGate>
        <div
            class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6"
            data-testid="clinic-dashboard"
        >
            <p
                v-if="loading"
                class="text-primary-text-muted"
            >
                {{ t('clinicDashboard.loading') }}
            </p>
            <div
                v-else-if="clinic === null"
                class="flex flex-col gap-2"
                data-testid="clinic-dashboard-no-access"
            >
                <h1 class="text-2xl font-semibold">
                    {{ t('clinicDashboard.noAccessHeading') }}
                </h1>
                <p class="text-primary-text-muted">
                    {{ t('clinicDashboard.noClinicsHelp') }}
                </p>
            </div>
            <template v-else>
                <header class="flex flex-col gap-1">
                    <p class="eyebrow">
                        {{ t('clinicDashboard.heading') }}
                    </p>
                    <h1 class="page-title-sm">
                        {{ clinic.clinicName }}
                    </h1>
                </header>

                <nav
                    class="flex flex-wrap gap-2 border-b border-accent-bg"
                    :aria-label="t('clinicDashboard.heading')"
                >
                    <NuxtLink
                        v-for="item in tabs"
                        :key="item.id"
                        :to="{ query: { tab: item.id } }"
                        class="-mb-px border-b-2 px-4 py-2.5 font-semibold transition-colors"
                        :class="tab === item.id && !bookingId
                            ? 'border-primary text-primary'
                            : 'border-transparent text-primary-text-muted hover:border-accent-bg hover:text-primary'"
                        :aria-current="tab === item.id && !bookingId ? 'page' : undefined"
                        :data-testid="`clinic-dashboard-tab-${item.id}`"
                    >
                        {{ item.label }}
                    </NuxtLink>
                </nav>

                <BookingSubmissionDetail
                    v-if="bookingId"
                    :booking-id="bookingId"
                    :back-to="{ query: { tab } }"
                />
                <ClinicBookingRequests
                    v-else-if="tab === 'requests'"
                    :facility-id="facilityId"
                    @open-booking="openBooking"
                />
                <div
                    v-else-if="tab === 'calendar'"
                    class="md:h-[75vh] md:min-h-[32rem]"
                >
                    <ClinicAvailabilityCalendar
                        :facility-id="facilityId"
                        @open-booking="openBooking"
                    />
                </div>
                <ClinicSettingsPanel
                    v-else-if="tab === 'settings' && clinic.canManage"
                    :facility-id="facilityId"
                />
                <ClinicTeamPanel
                    v-else-if="tab === 'team' && clinic.canManage"
                    :facility-id="facilityId"
                    :is-admin="clinic.role === null"
                />
            </template>
        </div>
    </ClinicDashboardGate>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingClinic } from '@findadoc/graphql'
import { definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useAuthStore } from '~/stores/authStore'
import { fetchBookingClinic } from '~/utils/booking/staffQuery'
import { formatPageTitle } from '~/utils/site'

/**
 * `/clinic-dashboard/{facilityId}`: one clinic's booking requests, calendar,
 * and (for owners and admins) settings and the team. A clinic subdomain's
 * `/dashboard` redirects here so sign-in stays on one origin.
 */
definePageMeta({
    ssr: false
})

type Tab = 'requests' | 'calendar' | 'settings' | 'team'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const facilityId = computed(() => String(route.params.facilityId ?? ''))
const clinic = ref<BookingClinic | null>(null)
const loading = ref(true)

const tab = computed((): Tab => {
    const value = route.query.tab
    if (value === 'calendar' || ((value === 'settings' || value === 'team') && clinic.value?.canManage)) {
        return value
    }
    return 'requests'
})
const bookingId = computed(() => typeof route.query.booking === 'string' ? route.query.booking : '')

const tabs = computed(() => [
    { id: 'requests', label: t('clinicDashboard.tabs.requests') },
    { id: 'calendar', label: t('clinicDashboard.tabs.calendar') },
    ...(clinic.value?.canManage
        ? [
            { id: 'settings', label: t('clinicDashboard.tabs.settings') },
            { id: 'team', label: t('clinicDashboard.tabs.team') }
        ]
        : [])
])

function openBooking(id: string): void {
    void navigateTo({ query: { tab: tab.value, booking: id } })
}

async function load(): Promise<void> {
    loading.value = true
    clinic.value = facilityId.value === '' ? null : await fetchBookingClinic(facilityId.value)
    loading.value = false
}

watch([() => authStore.isLoggedIn, facilityId], ([isLoggedIn]) => {
    if (isLoggedIn) {
        void load()
    }
}, { immediate: true })

useHead(() => ({
    title: formatPageTitle(clinic.value?.clinicName ?? t('clinicDashboard.heading')),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))
</script>
