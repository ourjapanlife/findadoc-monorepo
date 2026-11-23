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
            v-if="showReviewFilter"
            class="flex w-full min-w-0 flex-wrap items-center gap-2"
        >
            <FilterChip
                :model-value="reviewSelection"
                :items="reviewItems"
                :label="t('modDashboardTopbar.reviewFilter')"
                test-id="mod-review-filter"
                @update:model-value="setReviewSelection"
            />
        </div>
        <div
            v-if="moderationSubmissionsStore.selectedModerationListViewChosen === SelectedModerationListView.Submissions"
            class="flex w-full min-w-0 flex-wrap items-center gap-2"
        >
            <FilterChip
                :model-value="moderationSubmissionsStore.selectedSubmissionQueues"
                :items="queueItems"
                :label="t('modDashboardTopbar.statusFilter')"
                :default-value="defaultQueues"
                test-id="mod-submission-status-filter"
                multiselect
                @update:model-value="moderationSubmissionsStore.setSelectedSubmissionQueues"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SubmissionQueue } from '@findadoc/graphql'
import FilterChip from '~/components/common/FilterChip.vue'
import {
    SelectedModerationListView,
    DEFAULT_SUBMISSION_QUEUES,
    SUBMISSION_QUEUES,
    useModerationSubmissionsStore
} from '~/stores/moderationSubmissionsStore'
import { useCurrentUserAccessStore } from '~/stores/currentUserAccessStore'
import {
    PROFESSIONAL_REVIEW_QUEUE,
    useHealthcareProfessionalsStore,
    type ProfessionalReviewQueue
} from '~/stores/healthcareProfessionalsStore'
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

const showReviewFilter = computed(() =>
    moderationSubmissionsStore.selectedModerationListViewChosen
    === SelectedModerationListView.HealthcareProfessionals)

/** One review queue at a time (#313): a single-choice chip, empty for every professional. */
const reviewItems = computed(() => [
    { value: PROFESSIONAL_REVIEW_QUEUE.License, label: t('modDashboardTopbar.licenseReview') },
    { value: PROFESSIONAL_REVIEW_QUEUE.Name, label: t('modDashboardTopbar.nameReview') }
])

const reviewSelection = computed<ProfessionalReviewQueue[]>(() => {
    const queue = healthcareProfessionalsStore.reviewQueue
    return queue === null ? [] : [queue]
})

function setReviewSelection(selection: ProfessionalReviewQueue[]) {
    healthcareProfessionalsStore.setReviewQueue(selection[0] ?? null)
}

// Literal t() calls, so i18n/cleanUnusedLocaleKeys.js sees each key as used.
const QUEUE_LABEL_KEYS: Record<SubmissionQueue, () => string> = {
    [SubmissionQueue.New]: () => t('modDashboardLeftNav.new'),
    [SubmissionQueue.ForReview]: () => t('modDashboardLeftNav.forReview'),
    [SubmissionQueue.Approved]: () => t('modDashboardLeftNav.approved'),
    [SubmissionQueue.Rejected]: () => t('modDashboardLeftNav.rejected'),
    [SubmissionQueue.UserFeedback]: () => t('modDashboardLeftNav.userFeedback')
}

const defaultQueues = [...DEFAULT_SUBMISSION_QUEUES]

/** Five queues (#22). New is ticked by default, and a moderator ticks more to add them (#313). */
const queueItems = computed(() => SUBMISSION_QUEUES.map(queue => ({
    value: queue,
    label: QUEUE_LABEL_KEYS[queue](),
    count: moderationSubmissionsStore.statusTotalCounts[queue]
})))

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
