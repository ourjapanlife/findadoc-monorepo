<template>
    <section
        v-if="reports.length > 0"
        class="mod-sheet flex flex-col gap-3"
        aria-labelledby="mod-correction-other-reports-heading"
        data-testid="mod-correction-other-reports"
    >
        <div class="flex flex-col gap-1">
            <h3
                id="mod-correction-other-reports-heading"
                class="text-base font-semibold text-primary-text"
            >
                {{ t('modCorrectionReview.otherReportsHeading') }}
            </h3>
            <p class="m-0 text-sm text-primary-text-muted">
                {{ t('modCorrectionReview.otherReportsHint') }}
            </p>
        </div>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
            <li
                v-for="report in reports"
                :key="report.id"
                class="flex flex-wrap items-center gap-2 text-sm"
            >
                <NuxtLink
                    :to="`/my-page/edit-submission/${report.id}`"
                    class="text-primary underline underline-offset-4"
                    :data-testid="`mod-correction-other-report-${report.id}`"
                >
                    {{ t('modCorrectionReview.openOtherReport', { date: formatToReadableDate(report.createdDate) }) }}
                </NuxtLink>
                <span class="text-primary-text-muted">{{ reasonLabels(report) }}</span>
            </li>
        </ul>
    </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Submission } from '@findadoc/graphql'
import { formatToReadableDate } from '~/utils/dateUtils'
import { CORRECTION_REASON_OPTIONS } from '~/utils/facilityCorrection'
import { fetchOtherOpenReports } from '~/utils/moderationCorrections'

/**
 * The other open reports on the clinic under review, so a moderator sees them together and does
 * not check the same change twice. Nothing is shown while they load or when there are none.
 */
const props = defineProps<{
    facilityId: string
    currentId: string
}>()

const { t } = useI18n()
const reports = ref<Submission[]>([])

function reasonLabels(report: Submission): string {
    const reasons = report.correction?.reasons ?? []
    return CORRECTION_REASON_OPTIONS
        .filter(option => reasons.includes(option.reason))
        .map(option => t(option.labelKey))
        .join(', ')
}

async function load() {
    try {
        reports.value = await fetchOtherOpenReports(props.facilityId, props.currentId)
    } catch (error) {
        // The review still works without this list.
        console.error(`Error fetching other open reports: ${JSON.stringify(error)}`)
        reports.value = []
    }
}

onMounted(load)
watch(() => [props.facilityId, props.currentId], load)
</script>
