<template>
    <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h1
                class="displayed-section-header text-xl font-semibold text-primary-text md:text-2xl"
            >
                {{ updateTextForModerationDashboard(moderationSubmissionsStore.selectedModerationListViewChosen) }}
            </h1>
            <div
                class="flex w-full max-w-full min-w-0 flex-col gap-2
                landscape:flex-row landscape:flex-wrap landscape:justify-end"
            >
                <NuxtLink
                    v-if="showAddHpButton"
                    to="/my-page/create-healthcare-professional"
                    data-testid="add-hp-button"
                    class="inline-flex min-h-11 w-full max-w-full min-w-0 items-center justify-center
                    rounded-lg border border-accent-bg bg-secondary-bg px-3 py-2 text-center text-sm/tight
                    font-semibold wrap-break-word whitespace-normal
                    text-primary-text hover:bg-accent-bg/20 landscape:w-auto"
                >
                    {{ t('modDashboardTopbar.addHealthcareProfessional') }}
                </NuxtLink>
                <NuxtLink
                    v-if="showAddFacilityButton"
                    to="/my-page/create-facility"
                    data-testid="add-facility-button"
                    class="inline-flex min-h-11 w-full max-w-full min-w-0 items-center justify-center
                    rounded-lg border border-accent-bg bg-secondary-bg px-3 py-2 text-center text-sm/tight
                    font-semibold wrap-break-word whitespace-normal
                    text-primary-text hover:bg-accent-bg/20 landscape:w-auto"
                >
                    {{ t('modDashboardTopbar.addFacility') }}
                </NuxtLink>
                <label
                    v-if="showClinicPicker"
                    class="flex w-full min-w-0 flex-col gap-1 text-sm landscape:w-auto"
                >
                    <span class="font-medium text-primary-text">{{ t('modDashboardTopbar.openClinicDashboard') }}</span>
                    <select
                        v-model="pickedClinicId"
                        class="field max-w-md"
                        data-testid="mod-clinic-dashboard-picker"
                        :disabled="bookingClinics === null || bookingClinics.length === 0"
                        @change="openClinicDashboard"
                    >
                        <option
                            value=""
                            disabled
                        >
                            {{ bookingClinics === null
                                ? t('modDashboardTopbar.clinicsLoadError')
                                : bookingClinics.length === 0
                                    ? t('modDashboardTopbar.noBookingClinics')
                                    : t('modDashboardTopbar.chooseClinic') }}
                        </option>
                        <option
                            v-for="clinic in bookingClinics ?? []"
                            :key="clinic.facilityId"
                            :value="clinic.facilityId"
                        >
                            {{ clinic.requestedCount > 0
                                ? `${clinic.clinicName} (${clinic.requestedCount})`
                                : clinic.clinicName }}
                        </option>
                    </select>
                </label>
            </div>
        </div>
        <div
            v-if="showLicenseReviewFilter"
            class="grid w-full min-w-0 grid-cols-2 border-b border-accent-bg
            landscape:flex
            landscape:flex-wrap landscape:items-end portrait:[&>*:last-child:nth-child(odd)]:col-span-2"
        >
            <button
                type="button"
                data-testid="mod-license-review-filter"
                :class="queueFilterClass(healthcareProfessionalsStore.licenseReviewFilter !== null)"
                @click="toggleLicenseReviewFilter"
            >
                {{ t('modDashboardTopbar.licenseReview') }}
            </button>
        </div>
        <div
            v-if="moderationSubmissionsStore.selectedModerationListViewChosen === SelectedModerationListView.Submissions"
            class="grid w-full min-w-0 grid-cols-2 border-b border-accent-bg
            landscape:flex
            landscape:flex-wrap landscape:items-end portrait:[&>*:last-child:nth-child(odd)]:col-span-2"
        >
            <button
                type="button"
                :class="statusFilterClass(SelectedSubmissionListViewTab.New)"
                @click="updateSubmissionListViewState(SelectedSubmissionListViewTab.New)"
            >
                {{ t("modDashboardLeftNav.new") }} ({{ moderationSubmissionsStore.statusTotalCounts.newCount }})
            </button>
            <button
                type="button"
                :class="statusFilterClass(SelectedSubmissionListViewTab.ForReview)"
                @click="updateSubmissionListViewState(SelectedSubmissionListViewTab.ForReview)"
            >
                {{ t("modDashboardLeftNav.forReview") }} ({{ moderationSubmissionsStore.statusTotalCounts.forReviewCount }})
            </button>
            <button
                type="button"
                :class="statusFilterClass(SelectedSubmissionListViewTab.Approved)"
                @click="updateSubmissionListViewState(SelectedSubmissionListViewTab.Approved)"
            >
                {{ t("modDashboardLeftNav.approved") }} ({{ moderationSubmissionsStore.statusTotalCounts.approvedCount }})
            </button>
            <button
                type="button"
                :class="statusFilterClass(SelectedSubmissionListViewTab.Rejected)"
                @click="updateSubmissionListViewState(SelectedSubmissionListViewTab.Rejected)"
            >
                {{ t("modDashboardLeftNav.rejected") }} ({{ moderationSubmissionsStore.statusTotalCounts.rejectedCount }})
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { BookingClinic } from '@findadoc/graphql'
import {
    SelectedModerationListView,
    SelectedSubmissionListViewTab,
    useModerationSubmissionsStore
} from '~/stores/moderationSubmissionsStore'
import { useCurrentUserAccessStore } from '~/stores/currentUserAccessStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { navigateTo, useI18n } from '#imports'
import { fetchAllBookingClinics } from '~/utils/booking/staffQuery'
import { localeCodeFromPath, localizedPath } from '~/utils/localePath'

const { t } = useI18n()
const moderationSubmissionsStore = useModerationSubmissionsStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const accessStore = useCurrentUserAccessStore()

const showAddHpButton = computed(() =>
    moderationSubmissionsStore.selectedModerationListViewChosen
    === SelectedModerationListView.HealthcareProfessionals
    && (
        accessStore.loadError
        || !accessStore.isLoaded
        || accessStore.hasScope('write:healthcareprofessionals')
    ))

const showAddFacilityButton = computed(() =>
    moderationSubmissionsStore.selectedModerationListViewChosen
    === SelectedModerationListView.Facilities
    && (
        accessStore.loadError
        || !accessStore.isLoaded
        || accessStore.hasScope('write:facilities')
    ))

const route = useRoute()
const bookingClinics = ref<BookingClinic[] | null>([])
const pickedClinicId = ref('')

// Only admins hold read:bookings (moderators never see bookings). The picker opens one clinic's dashboard.
const showClinicPicker = computed(() =>
    moderationSubmissionsStore.selectedModerationListViewChosen === SelectedModerationListView.Bookings
    && accessStore.isLoaded
    && !accessStore.loadError
    && accessStore.hasScope('read:bookings'))

watch(showClinicPicker, async show => {
    if (show) {
        bookingClinics.value = await fetchAllBookingClinics()
    }
}, { immediate: true })

async function openClinicDashboard(): Promise<void> {
    if (pickedClinicId.value === '') {
        return
    }
    await navigateTo(localizedPath(`/clinic-dashboard/${pickedClinicId.value}`, localeCodeFromPath(route.path)))
}

const showLicenseReviewFilter = computed(() =>
    moderationSubmissionsStore.selectedModerationListViewChosen
    === SelectedModerationListView.HealthcareProfessionals)

function toggleLicenseReviewFilter() {
    const reviewIsOff = healthcareProfessionalsStore.licenseReviewFilter === null
    healthcareProfessionalsStore.setLicenseReviewFilter(reviewIsOff)
}

async function updateSubmissionListViewState(newValue: SelectedSubmissionListViewTab) {
    await moderationSubmissionsStore.setSelectedModerationListViewTabChosen(newValue)
}

function statusFilterClass(tab: SelectedSubmissionListViewTab): string {
    const isActive = moderationSubmissionsStore.selectedModerationListViewTabChosen === tab
    return queueFilterClass(isActive)
}

function queueFilterClass(isActive: boolean): string {
    const baseClass = 'min-h-11 w-full min-w-0 max-w-full break-words border-b-2 px-3 py-2.5'
      + ' text-center text-sm font-medium leading-tight whitespace-normal'
      + ' transition-colors landscape:w-auto landscape:px-4 landscape:text-left'

    return isActive
        ? `${baseClass} border-primary text-primary-text`
        : `${baseClass} border-transparent text-primary-text-muted hover:text-primary-text`
}

const updateTextForModerationDashboard = (selectedView: SelectedModerationListView) => {
    switch (selectedView) {
        case SelectedModerationListView.Submissions:
            return t('modDashboardLeftNav.submissions')
        case SelectedModerationListView.Facilities:
            return t('modDashboardTopbar.facilities')
        case SelectedModerationListView.HealthcareProfessionals:
            return t('modDashboardTopbar.healthcareProfessionals')
        case SelectedModerationListView.Bookings:
            return t('modDashboardLeftNav.bookings')
        case SelectedModerationListView.Availability:
            return t('modDashboardLeftNav.availability')
        default:
            return ''
    }
}
</script>
