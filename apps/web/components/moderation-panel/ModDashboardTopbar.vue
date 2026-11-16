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
                :aria-pressed="healthcareProfessionalsStore.licenseReviewFilter !== null"
                @click="toggleLicenseReviewFilter"
            >
                {{ t('modDashboardTopbar.licenseReview') }}
            </button>
            <button
                type="button"
                data-testid="mod-name-review-filter"
                :class="queueFilterClass(healthcareProfessionalsStore.nameReviewFilter !== null)"
                :aria-pressed="healthcareProfessionalsStore.nameReviewFilter !== null"
                @click="toggleNameReviewFilter"
            >
                {{ t('modDashboardTopbar.nameReview') }}
            </button>
        </div>
        <div
            v-if="moderationSubmissionsStore.selectedModerationListViewChosen === SelectedModerationListView.Submissions"
            class="grid w-full min-w-0 grid-cols-2 border-b border-accent-bg
            landscape:flex
            landscape:flex-wrap landscape:items-end portrait:[&>*:last-child:nth-child(odd)]:col-span-2"
        >
            <button
                v-for="tab in SUBMISSION_TABS"
                :key="tab.tab"
                type="button"
                :class="statusFilterClass(tab.tab)"
                :aria-pressed="moderationSubmissionsStore.selectedModerationListViewTabChosen === tab.tab"
                :data-testid="`mod-submission-tab-${tab.tab}`"
                @click="updateSubmissionListViewState(tab.tab)"
            >
                <span class="inline-flex items-center gap-2">
                    <component
                        :is="tab.icon"
                        class="size-4 shrink-0"
                        :class="tab.iconClass"
                        aria-hidden="true"
                    />
                    {{ t(tab.labelKey) }}
                    <span
                        class="min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums"
                        :class="tab.countClass"
                    >
                        {{ moderationSubmissionsStore.statusTotalCounts[tab.countKey] }}
                    </span>
                </span>
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
import SvgChatBubbles from '~/assets/icons/chat-bubbles.svg'
import SvgCheckMark from '~/assets/icons/check-mark.svg'
import SvgClose from '~/assets/icons/x-close-symbol.svg'
import SvgTime from '~/assets/icons/time-icon.svg'
import SvgInbox from '~/assets/icons/inbox.svg'

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

function toggleNameReviewFilter() {
    const reviewIsOff = healthcareProfessionalsStore.nameReviewFilter === null
    healthcareProfessionalsStore.setNameReviewFilter(reviewIsOff)
}

type SubmissionTabCountKey = keyof typeof moderationSubmissionsStore.statusTotalCounts

type SubmissionTab = {
    tab: SelectedSubmissionListViewTab
    labelKey: string
    countKey: SubmissionTabCountKey
    // nuxt-svgo makes each icon a component. Its module declaration types the import as string.
    icon: string
    iconClass: string
    countClass: string
}

/** Five queues (#22). Each has an icon and a count, so the color is never the only signal. */
const SUBMISSION_TABS: readonly SubmissionTab[] = [
    {
        tab: SelectedSubmissionListViewTab.New,
        labelKey: 'modDashboardLeftNav.new',
        countKey: 'newCount',
        icon: SvgInbox,
        iconClass: 'text-info',
        countClass: 'bg-info/10 text-primary-text'
    },
    {
        tab: SelectedSubmissionListViewTab.ForReview,
        labelKey: 'modDashboardLeftNav.forReview',
        countKey: 'forReviewCount',
        icon: SvgTime,
        iconClass: 'stroke-warning stroke-2',
        countClass: 'bg-warning/15 text-primary-text'
    },
    {
        tab: SelectedSubmissionListViewTab.Approved,
        labelKey: 'modDashboardLeftNav.approved',
        countKey: 'approvedCount',
        icon: SvgCheckMark,
        iconClass: 'text-success',
        countClass: 'bg-success/10 text-primary-text'
    },
    {
        tab: SelectedSubmissionListViewTab.Rejected,
        labelKey: 'modDashboardLeftNav.rejected',
        countKey: 'rejectedCount',
        icon: SvgClose,
        iconClass: 'text-error',
        countClass: 'bg-error/10 text-primary-text'
    },
    {
        tab: SelectedSubmissionListViewTab.UserFeedback,
        labelKey: 'modDashboardLeftNav.userFeedback',
        countKey: 'feedbackCount',
        icon: SvgChatBubbles,
        iconClass: 'stroke-accent stroke-2',
        countClass: 'bg-accent/20 text-primary-text'
    }
]

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
        case SelectedModerationListView.ClinicAccounts:
            return t('modDashboardLeftNav.clinicAccounts')
        default:
            return ''
    }
}
</script>
