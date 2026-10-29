<template>
    <div class="flex flex-col gap-3">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <h1
                class="displayed-section-header font-semibold text-xl md:text-2xl text-primary-text"
            >
                {{ updateTextForModerationDashboard(moderationSubmissionsStore.selectedModerationListViewChosen) }}
            </h1>
            <div
                class="flex w-full min-w-0 max-w-full flex-col gap-2
                landscape:flex-row landscape:flex-wrap landscape:justify-end"
            >
                <NuxtLink
                    v-if="showAddHpButton"
                    to="/my-page/create-healthcare-professional"
                    data-testid="add-hp-button"
                    class="inline-flex min-h-11 w-full min-w-0 max-w-full items-center justify-center
                    rounded-lg border border-accent-bg bg-secondary-bg px-3 py-2 text-center text-sm
                    font-semibold leading-tight break-words whitespace-normal
                    text-primary-text hover:bg-accent-bg/20 landscape:w-auto"
                >
                    {{ t('modDashboardTopbar.addHealthcareProfessional') }}
                </NuxtLink>
                <NuxtLink
                    v-if="showAddFacilityButton"
                    to="/my-page/create-facility"
                    data-testid="add-facility-button"
                    class="inline-flex min-h-11 w-full min-w-0 max-w-full items-center justify-center
                    rounded-lg border border-accent-bg bg-secondary-bg px-3 py-2 text-center text-sm
                    font-semibold leading-tight break-words whitespace-normal
                    text-primary-text hover:bg-accent-bg/20 landscape:w-auto"
                >
                    {{ t('modDashboardTopbar.addFacility') }}
                </NuxtLink>
            </div>
        </div>
        <div
            v-if="showLicenseReviewFilter"
            class="grid w-full min-w-0 grid-cols-2 border-b border-accent-bg
            portrait:[&>*:last-child:nth-child(odd)]:col-span-2
            landscape:flex landscape:flex-wrap landscape:items-end"
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
            portrait:[&>*:last-child:nth-child(odd)]:col-span-2
            landscape:flex landscape:flex-wrap landscape:items-end"
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
import { computed } from 'vue'
import {
    SelectedModerationListView,
    SelectedSubmissionListViewTab,
    useModerationSubmissionsStore
} from '~/stores/moderationSubmissionsStore'
import { useCurrentUserAccessStore } from '~/stores/currentUserAccessStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useI18n } from '#imports'

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
