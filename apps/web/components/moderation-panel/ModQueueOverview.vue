<template>
    <div class="h-full overflow-y-auto p-4 md:p-6">
        <div class="max-w-3xl">
            <h1 class="text-2xl md:text-3xl font-bold text-primary-text">
                {{ t('modQueueOverview.heading') }}
            </h1>
            <p class="mt-1 text-primary-text-muted">
                {{ t('modQueueOverview.subheading') }}
            </p>
            <div
                v-if="cards.length === 0"
                class="mt-6 text-primary-text-muted"
            >
                {{ t('accessPanel.none') }}
            </div>
            <div
                v-else
                class="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
                <button
                    v-for="card in cards"
                    :key="card.id"
                    type="button"
                    :data-testid="`mod-queue-${card.id}`"
                    class="flex flex-col items-start gap-2 rounded-xl border border-accent-bg bg-secondary-bg
                    px-4 py-5 text-left shadow-sm transition-colors hover:bg-accent-bg/20"
                    @click="openCard(card.id)"
                >
                    <span class="text-3xl font-semibold text-primary-text">
                        {{ card.count === null ? '…' : card.count }}
                    </span>
                    <span class="text-sm font-medium text-primary-text-muted">
                        {{ card.label }}
                    </span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCurrentUserAccessStore } from '~/stores/currentUserAccessStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import {
    SelectedModerationListView,
    SelectedSubmissionListViewTab,
    useModerationSubmissionsStore
} from '~/stores/moderationSubmissionsStore'
import {
    moderationQueueDestination,
    type ModerationQueueCard
} from '~/utils/moderationView'

const { t } = useI18n()
const router = useRouter()
const accessStore = useCurrentUserAccessStore()
const moderationSubmissionsStore = useModerationSubmissionsStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()

const submissionsReady = ref(false)
const allowWhileAccessUnknown = computed(() => accessStore.loadError || !accessStore.isLoaded)
const canReadSubmissions = computed(() => allowWhileAccessUnknown.value || accessStore.hasScope('read:submissions'))
const canReadHealthcareProfessionals = computed(
    () => allowWhileAccessUnknown.value || accessStore.hasScope('read:healthcareprofessionals')
)

const cards = computed(() => [
    ...(canReadSubmissions.value
        ? [{
            id: 'newSubmissions' as const,
            label: t('modQueueOverview.newSubmissions'),
            count: submissionsReady.value ? moderationSubmissionsStore.statusTotalCounts.newCount : null
        }, {
            id: 'forReview' as const,
            label: t('modQueueOverview.forReview'),
            count: submissionsReady.value ? moderationSubmissionsStore.statusTotalCounts.forReviewCount : null
        }]
        : []),
    ...(canReadHealthcareProfessionals.value
        ? [{
            id: 'licenseReview' as const,
            label: t('modQueueOverview.licenseReview'),
            count: healthcareProfessionalsStore.licenseReviewQueueCount
        }]
        : [])
])

async function openCard(card: ModerationQueueCard) {
    const destination = moderationQueueDestination(card)

    if (destination.view === 'submissions') {
        moderationSubmissionsStore.setSelectedModerationListViewChosen(SelectedModerationListView.Submissions)
        const tab = destination.submissionTab === 'FOR_REVIEW'
            ? SelectedSubmissionListViewTab.ForReview
            : SelectedSubmissionListViewTab.New
        await moderationSubmissionsStore.setSelectedModerationListViewTabChosen(tab)
    } else {
        moderationSubmissionsStore.setSelectedModerationListViewChosen(
            SelectedModerationListView.HealthcareProfessionals
        )
        await healthcareProfessionalsStore.setLicenseReviewFilter(destination.licenseReview)
    }

    await router.push({ path: '/my-page', query: { view: destination.view } })
}

onMounted(() => {
    if (canReadSubmissions.value) {
        void moderationSubmissionsStore.fetchStatusCounts().finally(() => {
            submissionsReady.value = true
        })
    }
    if (canReadHealthcareProfessionals.value) {
        void healthcareProfessionalsStore.fetchLicenseReviewQueueCount()
    }
})
</script>
