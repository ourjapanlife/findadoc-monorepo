<template>
    <div
        data-testid="clinic-correction-dialog"
        class="fixed inset-0 z-50 flex items-end justify-center bg-scrim/50 sm:items-center sm:p-4"
    >
        <div
            ref="panel"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            class="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-accent-bg
                bg-secondary-bg shadow-sm sm:rounded-xl"
        >
            <header class="flex items-start justify-between gap-4 border-b border-accent-bg p-5">
                <div class="flex flex-col gap-1">
                    <h2
                        :id="titleId"
                        class="text-lg font-semibold text-primary-text"
                    >
                        {{ variant === 'confirm' ? t('clinicCorrection.confirmHeading') : t('clinicCorrection.dialogTitle') }}
                    </h2>
                    <p
                        v-if="!sent"
                        class="m-0 text-sm text-primary-text-muted"
                    >
                        {{ facilityName }}
                    </p>
                </div>
                <button
                    ref="closeButton"
                    type="button"
                    class="btn btn-ghost btn-sm -mr-2 px-2"
                    data-testid="clinic-correction-close"
                    :aria-label="t('clinicCorrection.close')"
                    @click="emit('close')"
                >
                    <svg
                        class="size-5 stroke-current"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke-width="2"
                        stroke-linecap="round"
                        aria-hidden="true"
                    >
                        <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                </button>
            </header>

            <div
                v-if="sent"
                data-testid="clinic-correction-thanks"
                class="flex flex-col items-center gap-4 p-8 text-center"
                role="status"
            >
                <SvgHeartIcon
                    class="size-16 text-primary"
                    aria-hidden="true"
                />
                <p class="m-0 text-xl font-semibold text-primary-text">
                    {{ t('clinicCorrection.thanksHeading') }}
                </p>
                <p class="m-0 max-w-sm text-primary-text-muted">
                    {{ t('clinicCorrection.thanksBody') }}
                </p>
                <button
                    type="button"
                    class="btn btn-primary"
                    data-testid="clinic-correction-back"
                    @click="emit('close')"
                >
                    {{ t('clinicCorrection.backToClinic') }}
                </button>
            </div>

            <form
                v-else
                novalidate
                data-testid="clinic-correction-form"
                class="flex min-h-0 flex-col"
                @submit.prevent="send"
            >
                <div class="flex min-h-0 flex-col gap-6 overflow-y-auto p-5">
                    <p class="m-0 text-primary-text-muted">
                        {{ variant === 'confirm' ? t('clinicCorrection.confirmIntro') : t('clinicCorrection.dialogIntro') }}
                    </p>

                    <fieldset class="m-0 min-w-0 border-0 p-0">
                        <legend class="field-label">
                            {{ t('clinicCorrection.reasonsLegend') }}
                        </legend>
                        <p
                            id="clinic-correction-reasons-hint"
                            class="field-hint mt-0 mb-3"
                        >
                            {{ t('clinicCorrection.reasonsHint') }}
                        </p>
                        <div
                            class="flex flex-wrap gap-2"
                            aria-describedby="clinic-correction-reasons-hint"
                        >
                            <button
                                v-for="option in CORRECTION_REASON_OPTIONS"
                                :key="option.reason"
                                type="button"
                                class="chip h-11 gap-2 px-4 text-base transition-colors hover:border-primary"
                                :class="{ 'chip-primary': draft.reasons.includes(option.reason) }"
                                :aria-pressed="draft.reasons.includes(option.reason)"
                                :data-testid="`clinic-correction-reason-${option.reason}`"
                                @click="toggleReason(option.reason)"
                            >
                                <ClinicCorrectionReasonIcon :reason="option.reason" />
                                {{ t(option.labelKey) }}
                            </button>
                        </div>
                        <p
                            v-if="errors.reasons"
                            role="alert"
                            class="field-error"
                        >
                            {{ t(errors.reasons) }}
                        </p>
                    </fieldset>

                    <section
                        v-if="fields.length"
                        class="flex flex-col gap-4"
                        aria-labelledby="clinic-correction-fields-heading"
                    >
                        <div>
                            <h3
                                id="clinic-correction-fields-heading"
                                class="field-label mb-0"
                            >
                                {{ t('clinicCorrection.fieldsHeading') }}
                            </h3>
                            <p class="field-hint mt-1">
                                {{ baselineLoading ? t('clinicCorrection.loadingCurrent') : t('clinicCorrection.fieldsHint') }}
                            </p>
                        </div>
                        <ClinicCorrectionFields
                            v-model="draft"
                            :fields="fields"
                            :language-options="languageOptions"
                            :errors="errors"
                        />
                    </section>

                    <div>
                        <label
                            for="clinic-correction-notes"
                            class="field-label"
                        >
                            {{ t('clinicCorrection.notesLabel') }}
                            <span class="font-normal text-primary-text-muted">({{ t('clinicCorrection.optional') }})</span>
                        </label>
                        <textarea
                            id="clinic-correction-notes"
                            v-model="draft.notes"
                            data-testid="clinic-correction-notes"
                            class="field field-textarea"
                            :maxlength="CORRECTION_NOTES_MAX"
                            aria-describedby="clinic-correction-notes-hint"
                        />
                        <p
                            id="clinic-correction-notes-hint"
                            class="field-hint flex justify-between gap-4"
                        >
                            <span>{{ t('clinicCorrection.notesHint') }}</span>
                            <span class="shrink-0">{{ draft.notes.length }}/{{ CORRECTION_NOTES_MAX }}</span>
                        </p>
                    </div>

                    <fieldset class="m-0 min-w-0 border-0 p-0">
                        <legend class="field-label">
                            {{ t('clinicCorrection.relationLegend') }}
                            <span class="font-normal text-primary-text-muted">({{ t('clinicCorrection.optional') }})</span>
                        </legend>
                        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label
                                v-for="option in relationOptions"
                                :key="option.value ?? 'none'"
                                class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-accent-bg px-3
                                    has-checked:border-primary has-checked:bg-primary/5"
                            >
                                <input
                                    v-model="draft.reporterRelation"
                                    type="radio"
                                    name="clinic-correction-relation"
                                    class="size-4 accent-primary"
                                    :value="option.value"
                                    :data-testid="`clinic-correction-relation-${option.value ?? 'NONE'}`"
                                >
                                <span class="text-primary-text">{{ t(option.labelKey) }}</span>
                            </label>
                        </div>
                    </fieldset>

                    <p
                        v-if="refusal"
                        role="alert"
                        data-testid="clinic-correction-error"
                        class="m-0 rounded-lg border border-error/40 bg-error/5 p-3 text-sm font-medium text-error"
                    >
                        {{ t(REFUSAL_KEY[refusal]) }}
                    </p>
                </div>

                <footer class="flex flex-wrap justify-end gap-3 border-t border-accent-bg p-5">
                    <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        @click="emit('close')"
                    >
                        {{ t('clinicCorrection.cancel') }}
                    </button>
                    <button
                        type="submit"
                        class="btn btn-primary btn-sm"
                        data-testid="clinic-correction-submit"
                        :disabled="isSending"
                    >
                        {{ isSending ? t('clinicCorrection.sending') : t('clinicCorrection.submit') }}
                    </button>
                </footer>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FacilityCorrectionReason } from '@findadoc/graphql'
import SvgHeartIcon from '~/assets/icons/heart-icon.svg'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useScrollLock } from '~/composables/useScrollLock'
import { useUmami } from '~/composables/useUmamiTracking'
import { useFacilityCorrectionStore } from '~/stores/facilityCorrectionStore'
import { isJapaneseLocale } from '~/utils/activeLocale'
import { correctionSubmittedProps } from '~/utils/analyticsEvents'
import {
    CORRECTION_NOTES_MAX,
    CORRECTION_REASON_OPTIONS,
    CORRECTION_RELATION_OPTIONS,
    correctionDraftFromBaseline,
    correctionDraftErrors,
    correctionInputFromDraft,
    correctionLanguageOptions,
    correctionRefusal,
    toggleCorrectionReason,
    visibleCorrectionFields,
    type CorrectionBaseline,
    type CorrectionDraft,
    type CorrectionRefusal
} from '~/utils/facilityCorrection'

/**
 * The correction form as a modal (#22), so the visitor stays on the clinic page.
 * No sign-in and no contact details: the report is the reasons, the changed fields,
 * an optional note, and an optional "how do you know".
 */
const props = defineProps<{
    facility: CorrectionBaseline & { nameEn: string, nameJa?: string | null }
    variant: 'confirm' | 'error'
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const REFUSAL_KEY: Record<CorrectionRefusal, string> = {
    rateLimited: 'clinicCorrection.errorRateLimited',
    unavailable: 'clinicCorrection.errorUnavailable',
    invalidListingUrl: 'clinicCorrection.duplicateInvalid',
    invalid: 'clinicCorrection.errorInvalid',
    failed: 'clinicCorrection.errorFailed'
}

const { t, locale } = useI18n()
const { track } = useUmami()
const correctionStore = useFacilityCorrectionStore()

const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLElement | null>(null)
const titleId = useId()
const isActive = ref(true)

useScrollLock(isActive)
useFocusTrap(panel, isActive, { onEscape: () => emit('close'), initialFocus: closeButton })

const baseline = ref<CorrectionBaseline>(props.facility)
const baselineLoading = ref(true)
const draft = ref<CorrectionDraft>(correctionDraftFromBaseline(props.facility))
const submitAttempted = ref(false)
const isSending = ref(false)
const sent = ref(false)
const refusal = ref<CorrectionRefusal | null>(null)

const facilityName = computed(() => (isJapaneseLocale(locale.value) ? props.facility.nameJa : props.facility.nameEn)
  || props.facility.nameEn)
const fields = computed(() => visibleCorrectionFields(draft.value.reasons))
const languageOptions = computed(() => correctionLanguageOptions(baseline.value.supportedLanguages ?? []))
// Shown only after a send attempt, so a half-typed field is not flagged while the visitor is still typing.
const errors = computed(() => (submitAttempted.value ? correctionDraftErrors(draft.value, baseline.value) : {}))
const relationOptions = computed(() => [
    ...CORRECTION_RELATION_OPTIONS.map(option => ({ value: option.relation, labelKey: option.labelKey })),
    { value: null, labelKey: 'clinicCorrection.relationNone' }
])

function toggleReason(reason: FacilityCorrectionReason) {
    draft.value = { ...draft.value, reasons: toggleCorrectionReason(draft.value.reasons, reason) }
}

/*
 * The page values can be days old. Swap in the live ones only while the visitor has not
 * picked a reason yet, so a slow answer never overwrites something they already typed.
 */
onMounted(async () => {
    try {
        const current = await correctionStore.fetchCurrentFacility(props.facility.id)
        if (current && draft.value.reasons.length === 0) {
            baseline.value = current
            draft.value = correctionDraftFromBaseline(current)
        }
    } finally {
        baselineLoading.value = false
    }
})

async function send() {
    if (isSending.value) {
        return
    }
    submitAttempted.value = true
    refusal.value = null

    if (Object.keys(correctionDraftErrors(draft.value, baseline.value)).length > 0) {
        track('Correction rejected', { reason: 'validation' })
        return
    }

    isSending.value = true
    try {
        const response = await correctionStore.submitCorrection(correctionInputFromDraft(draft.value, baseline.value))
        if (response.hasErrors || response.data?.submitFacilityCorrection?.isSuccessful !== true) {
            refusal.value = correctionRefusal(response.errors)
            track('Correction rejected', { reason: 'server' })
            return
        }
        track('Correction submitted', correctionSubmittedProps(draft.value.reasons))
        sent.value = true
    } finally {
        isSending.value = false
    }
}
</script>
