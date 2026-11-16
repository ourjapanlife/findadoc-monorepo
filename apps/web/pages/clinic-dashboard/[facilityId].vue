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
                        :class="tab === item.id && !openBookingId
                            ? 'border-primary text-primary'
                            : 'border-transparent text-primary-text-muted hover:border-accent-bg hover:text-primary'"
                        :aria-current="tab === item.id && !openBookingId ? 'page' : undefined"
                        :data-testid="`clinic-dashboard-tab-${item.id}`"
                    >
                        {{ item.label }}
                    </NuxtLink>
                </nav>

                <BookingSubmissionDetail
                    v-if="openBookingId"
                    :booking-id="openBookingId"
                    :back-to="{ query: { tab } }"
                />
                <ClinicBookingRequests
                    v-else-if="tab === 'requests' && isClinicMember(clinic)"
                    :facility-id="facilityId"
                    :can-manage="isClinicOwner(clinic)"
                    :takes-payment="clinic.takesPayment"
                    @open-booking="openBooking"
                />
                <div
                    v-else-if="tab === 'calendar' && isClinicMember(clinic)"
                    class="md:h-[75vh] md:min-h-128"
                >
                    <ClinicAvailabilityCalendar
                        :facility-id="facilityId"
                        @open-booking="openBooking"
                    />
                </div>
                <ClinicSettingsPanel
                    v-else-if="tab === 'settings' && isClinicOwner(clinic)"
                    :facility-id="facilityId"
                />
                <ClinicTeamPanel
                    v-else-if="tab === 'team' && (isClinicOwner(clinic) || clinic.isAdmin)"
                    :facility-id="facilityId"
                    :is-admin="clinic.isAdmin"
                    :show-interpretation="clinic.isAdmin && !isClinicOwner(clinic)"
                />
            </template>
        </div>
    </ClinicDashboardGate>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingClinic } from '@findadoc/graphql'
import { definePageMeta, navigateTo, useHead, useRoute } from '#imports'
import { useClinicBranding } from '~/composables/useClinicBranding'
import { useAuthStore } from '~/stores/authStore'
import { useMyBookingClinicsStore } from '~/stores/myBookingClinicsStore'
import {
    clinicDashboardTabs,
    isClinicMember,
    isClinicOwner,
    selectedClinicDashboardTab,
    type ClinicDashboardTab
} from '~/utils/booking/clinicDashboardTabs'
import { fetchBookingClinic } from '~/utils/booking/staffQuery'
import { formatPageTitle } from '~/utils/site'

/**
 * `/clinic-dashboard/{facilityId}`: one clinic's booking requests, calendar,
 * settings (owners), and team (owners and admins). An admin who is not a member
 * sees the team and the interpretation switch only, never a booking (#192). A clinic subdomain's
 * `/dashboard` redirects here so sign-in stays on one origin.
 * A clinic with a clinic page gets its own header (online consult v2 §4), which keeps
 * sign-out and the way back to the clinic picker. Signed out, it is the Find a Doc layout.
 */
definePageMeta({
    ssr: false,
    layout: 'clinic-branded'
})

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const myBookingClinicsStore = useMyBookingClinicsStore()
const clinicBranding = useClinicBranding()
const facilityId = computed(() => String(route.params.facilityId ?? ''))
const clinic = ref<BookingClinic | null>(null)
const loading = ref(true)

const tabIds = computed(() => clinicDashboardTabs(clinic.value))
const tab = computed(() => selectedClinicDashboardTab(route.query.tab, tabIds.value))
const bookingId = computed(() => typeof route.query.booking === 'string' ? route.query.booking : '')
const openBookingId = computed(() =>
    clinic.value !== null && isClinicMember(clinic.value) ? bookingId.value : '')

const tabLabels = computed((): Record<ClinicDashboardTab, string> => ({
    requests: t('clinicDashboard.tabs.requests'),
    calendar: t('clinicDashboard.tabs.calendar'),
    settings: t('clinicDashboard.tabs.settings'),
    team: t('clinicDashboard.tabs.team')
}))
const tabs = computed(() => tabIds.value.map(id => ({ id, label: tabLabels.value[id] })))

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

watchEffect(() => {
    const loaded = clinic.value
    const branding = loaded?.branding
    if (!authStore.isLoggedIn || loaded === null || branding === null || branding === undefined) {
        clinicBranding.clear()
        return
    }
    clinicBranding.show({
        branding,
        staff: true,
        // An admin opens every clinic's account. A member of one clinic has nowhere to switch to.
        canSwitchClinic: loaded.isAdmin || (myBookingClinicsStore.clinics?.length ?? 0) > 1,
        localeSelector: true
    })
})

useHead(() => ({
    title: formatPageTitle(clinic.value?.clinicName ?? t('clinicDashboard.heading')),
    meta: [{ name: 'robots', content: 'noindex', key: 'robots' }]
}))
</script>
