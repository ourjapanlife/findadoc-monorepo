<template>
    <Loader />
    <div
        v-if="submission && correction"
        class="flex flex-col gap-6"
        data-testid="mod-correction-review"
    >
        <section class="mod-sheet flex flex-col gap-3">
            <div class="flex flex-wrap items-center gap-2">
                <ModStatusPill
                    v-for="pill in pills"
                    :key="pill"
                    :pill="pill"
                />
                <span class="text-sm text-primary-text-muted">
                    {{ t('modCorrectionReview.reportedOn', { date: formatToReadableDate(submission.createdDate) }) }}
                </span>
            </div>
            <h2
                class="text-xl font-semibold text-primary-text"
                data-testid="mod-correction-facility-name"
            >
                {{ facilityTitle }}
            </h2>
            <p
                v-if="facilityLoadFailed"
                class="m-0 text-sm text-error"
                role="alert"
            >
                {{ t('modCorrectionReview.facilityMissing') }}
            </p>
            <div
                v-if="facility"
                class="flex flex-wrap gap-3 text-sm"
            >
                <a
                    :href="clinicPagePath"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary underline underline-offset-4"
                    data-testid="mod-correction-clinic-page"
                >
                    {{ t('modCorrectionReview.openClinicPage') }}
                </a>
                <NuxtLink
                    :to="`/my-page/edit-facility/${facility.id}`"
                    class="text-primary underline underline-offset-4"
                    data-testid="mod-correction-edit-facility"
                >
                    {{ t('modCorrectionReview.editFacility') }}
                </NuxtLink>
            </div>
            <button
                v-if="isNew"
                type="button"
                class="btn btn-secondary btn-sm w-fit"
                data-testid="mod-correction-start-review"
                :disabled="isBusy"
                @click="startReview"
            >
                {{ t('modCorrectionReview.startReview') }}
            </button>
        </section>

        <ModCorrectionOtherReports
            :facility-id="correction.facilityId"
            :current-id="submission.id"
        />

        <section
            class="mod-sheet flex flex-col gap-3"
            aria-labelledby="mod-correction-reasons-heading"
        >
            <h3
                id="mod-correction-reasons-heading"
                class="text-base font-semibold text-primary-text"
            >
                {{ t('modCorrectionReview.reasonsHeading') }}
            </h3>
            <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
                <li
                    v-for="option in reasonOptions"
                    :key="option.reason"
                    class="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1
                    text-sm font-semibold text-primary-text"
                    :data-testid="`mod-correction-reason-${option.reason}`"
                >
                    <ClinicCorrectionReasonIcon :reason="option.reason" />
                    {{ t(option.labelKey) }}
                </li>
            </ul>
        </section>

        <section
            class="mod-sheet flex flex-col gap-3"
            aria-labelledby="mod-correction-changes-heading"
        >
            <h3
                id="mod-correction-changes-heading"
                class="text-base font-semibold text-primary-text"
            >
                {{ t('modCorrectionReview.changesHeading') }}
            </h3>
            <p class="m-0 text-sm text-primary-text-muted">
                {{ t('modCorrectionReview.changesHint') }}
            </p>
            <template v-if="facility">
                <ModCorrectionChange
                    v-for="row in changeRows"
                    :key="row.field"
                    :row="row"
                />
                <p
                    v-if="changeRows.length === 0"
                    class="m-0 text-sm text-primary-text"
                    data-testid="mod-correction-no-changes"
                >
                    {{ t('modCorrectionReview.noChanges') }}
                </p>
            </template>

            <div
                v-if="needsCity"
                class="flex flex-col gap-2 rounded-lg border border-warning/50 bg-warning/10 p-4"
                data-testid="mod-correction-city"
            >
                <p class="m-0 text-sm text-primary-text">
                    {{ t('modCorrectionReview.cityHint') }}
                </p>
                <p
                    v-if="currentCityName"
                    class="m-0 text-sm text-primary-text-muted"
                >
                    {{ t('modCorrectionReview.currentCity', { city: currentCityName }) }}
                </p>
                <ModCityPicker
                    id="mod-correction-city-picker"
                    :label="t('modCorrectionReview.cityLabel')"
                    :prefecture-en="cityPrefectureEn"
                    :city-id="pickedCityId"
                    test-id="mod-correction-city-picker"
                    required
                    @select="pickCity"
                />
            </div>
        </section>

        <section
            v-if="handOffReasons.length > 0"
            class="mod-sheet flex flex-col gap-3"
            data-testid="mod-correction-hand-off"
        >
            <p
                v-if="handOffReasons.includes(FacilityCorrectionReason.Closed)"
                class="m-0 text-sm text-primary-text"
            >
                {{ t('modCorrectionReview.closedNotice') }}
            </p>
            <div
                v-if="handOffReasons.includes(FacilityCorrectionReason.Duplicate)"
                class="flex flex-col gap-1"
            >
                <p class="m-0 text-sm text-primary-text">
                    {{ t('modCorrectionReview.duplicateNotice') }}
                </p>
                <a
                    v-if="duplicateHref"
                    :href="duplicateHref"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-fit text-sm wrap-anywhere text-primary underline underline-offset-4"
                    data-testid="mod-correction-duplicate-link"
                >
                    {{ t('modCorrectionReview.duplicateOtherListing') }}: {{ duplicateHref }}
                </a>
                <p
                    v-else
                    class="m-0 text-sm text-primary-text-muted"
                >
                    {{ t('modCorrectionReview.duplicateNoLink') }}
                </p>
            </div>
        </section>

        <section class="mod-sheet flex flex-col gap-3">
            <div class="flex flex-col gap-1">
                <h3 class="text-base font-semibold text-primary-text">
                    {{ t('modCorrectionReview.notesHeading') }}
                </h3>
                <p
                    class="m-0 text-sm wrap-anywhere whitespace-pre-line text-primary-text"
                    data-testid="mod-correction-notes"
                >
                    {{ submission.notes?.trim() || t('modCorrectionReview.noNotes') }}
                </p>
            </div>
            <div class="flex flex-col gap-1">
                <h3 class="text-base font-semibold text-primary-text">
                    {{ t('modCorrectionReview.relationHeading') }}
                </h3>
                <p class="m-0 text-sm text-primary-text">
                    {{ relationLabel }}
                </p>
            </div>
            <p class="m-0 text-xs text-primary-text-muted">
                {{ t('modCorrectionReview.retentionNote') }}
            </p>
        </section>
    </div>
    <p
        v-else-if="!loadingStore.isLoading"
        class="text-primary-text"
        data-testid="mod-correction-missing"
    >
        {{ t('modCorrectionReview.submissionMissing') }}
    </p>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FacilityCorrectionReason, type Facility } from '@findadoc/graphql'
import { useAppToast } from '~/composables/useAppToast'
import { handleModerationResponseErrors } from '~/composables/useModerationResponseHandling'
import { ModerationSubmissionActionType, useModerationSubmissionActions } from '~/composables/useModerationSubmissionActions'
import { useModerationSubmissionsStore } from '~/stores/moderationSubmissionsStore'
import { facilityPath } from '~/utils/clinicPath'
import { formatToReadableDate } from '~/utils/dateUtils'
import { CORRECTION_REASON_OPTIONS, CORRECTION_RELATION_OPTIONS } from '~/utils/facilityCorrection'
import {
    correctionChangeRows,
    correctionHandOffReasons,
    correctionNeedsCity,
    duplicateListingHref
} from '~/utils/facilityCorrectionReview'
import { fetchCorrectionFacility } from '~/utils/moderationCorrections'
import { MODERATION_STATUS, moderationPills, moderationStatus } from '~/utils/moderationSubmissionStatus'
import { leaveToModerationDashboard } from '~/utils/moderationUtils'
import { GENERIC_FORM_ERROR_KEY, translatedFormError } from '~/utils/formErrorMessage'
import type { CityOption } from '~/utils/cityOptions'

/**
 * A visitor's correction in moderation (#22): the reasons, then before → after for each field the
 * visitor sent. Approval writes only those fields (apps/server/docs/facility-corrections.md).
 * Closed and Duplicate change nothing; the moderator unpublishes or merges from the facility.
 */
const { t, te } = useI18n()
const toast = useAppToast()
const router = useRouter()
const modalStore = useModalStore()
const screenStore = useModerationScreenStore()
const loadingStore = useLoadingStore()
const submissionsStore = useModerationSubmissionsStore()
const { moderationSubmissionAction } = useModerationSubmissionActions()

const facility = ref<Facility | null>(null)
const facilityLoadFailed = ref(false)
const pickedCityId = ref('')
const isBusy = ref(false)
const lastHandledActionId = ref(0)

const submission = computed(() => submissionsStore.selectedSubmissionData)
const correction = computed(() => submission.value?.correction ?? null)
const pills = computed(() => submission.value ? moderationPills(submission.value) : [])
const isNew = computed(() => submission.value !== undefined
  && moderationStatus(submission.value) === MODERATION_STATUS.New)

const reasonOptions = computed(() => CORRECTION_REASON_OPTIONS
    .filter(option => correction.value?.reasons.includes(option.reason)))
const changeRows = computed(() => facility.value && correction.value
    ? correctionChangeRows(facility.value, correction.value)
    : [])
const needsCity = computed(() => correction.value ? correctionNeedsCity(correction.value) : false)
const handOffReasons = computed(() => correction.value ? correctionHandOffReasons(correction.value) : [])
const duplicateHref = computed(() => duplicateListingHref(correction.value?.duplicateListingUrl))

const facilityTitle = computed(() => {
    const names = [facility.value?.nameEn, facility.value?.nameJa].filter(name => name)
    return names.length > 0 ? names.join(' · ') : t('modListContainerItem.feedbackSubmission')
})
const clinicPagePath = computed(() => facility.value ? facilityPath(facility.value) : '')
const currentCityName = computed(() => {
    const city = facility.value?.city
    return city ? [city.nameEn, city.nameJa].filter(name => name).join(' · ') : ''
})
// The city list follows the prefecture the visitor sent, or the clinic's own.
const cityPrefectureEn = computed(() => correction.value?.changes.address?.prefectureEn
  ?? facility.value?.contact?.address?.prefectureEn
  ?? '')
const relationLabel = computed(() => {
    const relation = correction.value?.reporterRelation
    const option = CORRECTION_RELATION_OPTIONS.find(candidate => candidate.relation === relation)
    return option ? t(option.labelKey) : t('modCorrectionReview.relationUnknown')
})

function pickCity(city: CityOption | null) {
    pickedCityId.value = city?.id ?? ''
}

async function loadFacility() {
    const facilityId = correction.value?.facilityId
    if (facilityId === undefined) {
        return
    }
    loadingStore.setIsLoading(true)
    try {
        facility.value = await fetchCorrectionFacility(facilityId)
        facilityLoadFailed.value = facility.value === null
    } catch {
        facility.value = null
        facilityLoadFailed.value = true
    } finally {
        loadingStore.setIsLoading(false)
    }
}

async function closeModal() {
    await nextTick()
    modalStore.hideModal()
}

/** True when the update went through. A refusal shows its toast here. */
async function sendUpdate(input: { isUnderReview?: boolean, correctionCityId?: string }): Promise<boolean> {
    const id = submissionsStore.selectedSubmissionId
    if (!id) {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        return false
    }
    const result = await submissionsStore.updateSubmission({ id, input })
    if (handleModerationResponseErrors(result, toast, t, te)) {
        return false
    }
    const updated = result.data?.updateSubmission
    return updated !== undefined && updated !== null
}

async function startReview() {
    isBusy.value = true
    try {
        if (await sendUpdate({ isUnderReview: true })) {
            toast.success(t('modCorrectionReview.startedReview'))
        }
    } finally {
        isBusy.value = false
    }
}

/** A city change needs the moderator's city first. The API refuses approval without it. */
async function saveCityBeforeApproval(): Promise<boolean> {
    if (!needsCity.value) {
        return true
    }
    const storedCityId = correction.value?.changes.cityId ?? ''
    const cityId = pickedCityId.value || storedCityId
    if (cityId === '') {
        toast.error(t('serverErrorMessages.correctionCityRequired'))
        return false
    }
    return cityId === storedCityId || await sendUpdate({ isUnderReview: true, correctionCityId: cityId })
}

async function approve() {
    isBusy.value = true
    try {
        if (!await saveCityBeforeApproval()) {
            return
        }
        const result = await submissionsStore.approveSubmission()
        if (!result || handleModerationResponseErrors(result, toast, t, te)) {
            return
        }
        toast.success(t('modCorrectionReview.approved'))
        await leaveToModerationDashboard(router, screenStore, modalStore, 'submissions')
    } finally {
        isBusy.value = false
        await closeModal()
    }
}

async function decline() {
    isBusy.value = true
    try {
        const result = await submissionsStore.rejectSubmission()
        if (!result || handleModerationResponseErrors(result, toast, t, te)) {
            return
        }
        toast.success(t('modCorrectionReview.declined'))
        await leaveToModerationDashboard(router, screenStore, modalStore, 'submissions')
    } finally {
        isBusy.value = false
        await closeModal()
    }
}

// The topbar's Approve and Decline buttons. Update does not apply to a correction.
watch(moderationSubmissionAction, action => {
    if (!action || action.id === lastHandledActionId.value) {
        return
    }
    lastHandledActionId.value = action.id

    if (action.type === ModerationSubmissionActionType.Approve) {
        useNuxtApp().$withConfirmation(() => {
            void approve()
        }, {
            title: t('modEditSubmissionTopNav.approve'),
            message: t('modCorrectionReview.approveConfirm'),
            textConfirm: t('modCorrectionReview.approveConfirmButton'),
            textCancel: t('common.cancel')
        })
        return
    }
    if (action.type === ModerationSubmissionActionType.Reject) {
        useNuxtApp().$withConfirmation(() => {
            void decline()
        }, {
            title: t('modEditSubmissionTopNav.reject'),
            message: t('modCorrectionReview.declineConfirm'),
            textConfirm: t('modCorrectionReview.declineConfirmButton'),
            textCancel: t('common.cancel'),
            destructive: true
        })
    }
})

watch(() => correction.value?.facilityId, () => {
    pickedCityId.value = correction.value?.changes.cityId ?? ''
    void loadFacility()
})

onMounted(() => {
    // The first Approve or Decline after mounting is new; an older one in shared state is not.
    lastHandledActionId.value = moderationSubmissionAction.value?.id ?? 0
    pickedCityId.value = correction.value?.changes.cityId ?? ''
    void loadFacility()
})
</script>
