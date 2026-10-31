<template>
    <div
        class="flex flex-col gap-6"
        data-testid="clinic-settings-panel"
    >
        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.loadError') }}
        </p>

        <ClinicWeeklyHoursEditor :facility-id="props.facilityId" />

        <form
            v-if="settings"
            class="card flex flex-col gap-6 p-5 shadow-card landscape:p-6"
            @submit.prevent="saveSettings"
        >
            <h2 class="text-xl font-bold tracking-tight text-primary-text">
                {{ t('clinicDashboard.settings.heading') }}
            </h2>

            <fieldset class="flex flex-col gap-3">
                <legend class="field-label">
                    {{ t('bookingPage.durationLabel') }}
                </legend>
                <p class="-mt-1 text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.settings.durationsHelp') }}
                </p>
                <div class="flex flex-wrap gap-2">
                    <label
                        v-for="minutes in ALLOWED_APPOINTMENT_DURATIONS"
                        :key="minutes"
                        class="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4
                        text-sm font-semibold transition-colors has-focus-visible:outline-2
                        has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-text"
                        :class="durations.includes(minutes)
                            ? 'border-primary bg-primary text-primary-text-inverted hover:bg-primary-hover'
                            : 'border-border-strong bg-secondary-bg text-primary-text hover:border-primary'"
                    >
                        <input
                            v-model="durations"
                            type="checkbox"
                            class="sr-only"
                            :value="minutes"
                        >
                        <svg
                            v-if="durations.includes(minutes)"
                            class="size-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {{ t('bookingPage.durationMinutes', { n: minutes }) }}
                        <span
                            v-if="minutes === defaultDuration"
                            class="rounded-full bg-primary-text-inverted/20 px-2 py-0.5 text-xs"
                        >
                            {{ t('clinicDashboard.settings.defaultForm') }}
                        </span>
                    </label>
                </div>
                <div
                    v-if="durations.length > 1"
                    role="radiogroup"
                    :aria-labelledby="defaultDurationLabelId"
                    class="flex flex-wrap items-center gap-x-4 gap-y-2"
                >
                    <span
                        :id="defaultDurationLabelId"
                        class="text-sm font-semibold text-primary-text"
                    >
                        {{ t('clinicDashboard.settings.defaultDuration') }}
                    </span>
                    <label
                        v-for="minutes in sortedDurations"
                        :key="minutes"
                        class="inline-flex cursor-pointer items-center gap-2 text-sm"
                        :class="defaultDuration === minutes ? 'font-semibold text-primary' : 'text-primary-text-muted'"
                    >
                        <input
                            v-model="defaultDuration"
                            type="radio"
                            name="default-duration"
                            class="size-4 accent-primary"
                            :value="minutes"
                            data-testid="clinic-settings-default-duration"
                        >
                        {{ t('bookingPage.durationMinutes', { n: minutes }) }}
                    </label>
                </div>
            </fieldset>

            <fieldset class="flex flex-col gap-3">
                <legend class="field-label">
                    {{ t('clinicDashboard.settings.forms') }}
                </legend>
                <p class="-mt-1 text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.settings.formsHelp') }}
                </p>
                <div class="grid gap-3 landscape:grid-cols-2">
                    <div
                        v-for="formType in formTypes"
                        :key="formType.id"
                        class="flex flex-col gap-3 rounded-lg border p-4 transition-colors"
                        :class="formIds.includes(formType.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-accent-bg bg-secondary-bg'"
                    >
                        <label class="flex cursor-pointer items-start gap-3">
                            <input
                                v-model="formIds"
                                type="checkbox"
                                class="mt-0.5 size-5 shrink-0 accent-primary"
                                :value="formType.id"
                            >
                            <span class="font-semibold text-primary-text">{{ t(formType.labelKey) }}</span>
                        </label>
                        <label
                            v-if="formIds.includes(formType.id)"
                            class="ml-8 inline-flex w-fit cursor-pointer items-center gap-2 text-sm"
                            :class="defaultFormId === formType.id ? 'font-semibold text-primary' : 'text-primary-text-muted'"
                        >
                            <input
                                v-model="defaultFormId"
                                type="radio"
                                name="default-form"
                                class="size-4 accent-primary"
                                :value="formType.id"
                            >
                            {{ t('clinicDashboard.settings.defaultForm') }}
                        </label>
                    </div>
                </div>
            </fieldset>

            <div class="flex items-center gap-3 border-t border-accent-bg pt-5">
                <button
                    type="submit"
                    class="btn btn-primary min-w-40"
                    :disabled="savingSettings || durations.length === 0 || formIds.length === 0"
                    :aria-busy="savingSettings"
                    data-testid="clinic-settings-save"
                >
                    <ButtonSpinner v-if="savingSettings" />
                    {{ savingSettings ? t('clinicDashboard.saving') : t('clinicDashboard.settings.save') }}
                </button>
            </div>
        </form>

        <section
            v-if="settings"
            class="card flex flex-col gap-3 p-5 shadow-card landscape:p-6"
            data-testid="clinic-settings-interpretation"
        >
            <label
                class="flex items-start gap-3"
                :class="settings.canChangeInterpretation ? 'cursor-pointer' : 'cursor-not-allowed'"
            >
                <input
                    type="checkbox"
                    class="mt-0.5 size-5 shrink-0 accent-primary"
                    :checked="settings.offersInterpretation"
                    :disabled="!settings.canChangeInterpretation || savingInterpretation"
                    :aria-describedby="interpretationHelpId"
                    data-testid="clinic-settings-interpretation-toggle"
                    @change="toggleInterpretation"
                >
                <span class="font-semibold text-primary-text">{{ t('clinicDashboard.settings.interpretation') }}</span>
            </label>
            <p
                :id="interpretationHelpId"
                class="ml-8 text-sm text-primary-text-muted"
            >
                {{ t('clinicDashboard.settings.interpretationHelp') }}
                <template v-if="!settings.canChangeInterpretation">
                    {{ t('clinicDashboard.settings.interpretationLocked') }}
                </template>
            </p>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingFormType, BookingSettings } from '@findadoc/graphql'
import ClinicWeeklyHoursEditor from '~/components/booking/ClinicWeeklyHoursEditor.vue'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import { ALLOWED_APPOINTMENT_DURATIONS, resolveDuration } from '~/utils/booking/durations'
import { fetchClinicAdmin, setBookingInterpretation, updateBookingSettings } from '~/utils/booking/staffQuery'

/**
 * Owner settings: weekly hours, visit lengths, and which intake forms the clinic offers.
 * Who may use the dashboard is the Team tab (ClinicTeamPanel).
 */
const props = defineProps<{
    facilityId: string
}>()

const { t } = useI18n()
const toast = useAppToast()
const settings = ref<BookingSettings | null>(null)
const formTypes = ref<BookingFormType[]>([])
const durations = ref<number[]>([])
const defaultDuration = ref<number | undefined>(undefined)
const defaultDurationLabelId = 'clinic-settings-default-duration'
const formIds = ref<string[]>([])
const defaultFormId = ref('')
const loadError = ref(false)
const savingSettings = ref(false)
const savingInterpretation = ref(false)
const interpretationHelpId = 'clinic-settings-interpretation-help'

const sortedDurations = computed(() => [...durations.value].sort((a, b) => a - b))

async function load(): Promise<void> {
    const loaded = await fetchClinicAdmin(props.facilityId)
    loadError.value = loaded === null
    if (loaded === null) {
        return
    }
    settings.value = loaded.settings
    formTypes.value = loaded.formTypes
    durations.value = [...(loaded.settings?.allowedDurations ?? [])]
    defaultDuration.value = durations.value.length === 0
        ? undefined
        : resolveDuration(loaded.settings?.defaultDuration, sortedDurations.value)
    formIds.value = [...(loaded.settings?.formDefinitionIds ?? [])]
    defaultFormId.value = formIds.value[0] ?? ''
}

// Unchecking the default length moves it to 30 minutes when offered, else the shortest.
watch(durations, offered => {
    if (defaultDuration.value === undefined || !offered.includes(defaultDuration.value)) {
        defaultDuration.value = offered.length === 0 ? undefined : resolveDuration(null, sortedDurations.value)
    }
})

// Unchecking the default form moves the default to the next offered form.
watch(formIds, ids => {
    if (!ids.includes(defaultFormId.value)) {
        defaultFormId.value = ids[0] ?? ''
    }
})

async function saveSettings(): Promise<void> {
    savingSettings.value = true
    const ordered = [defaultFormId.value, ...formIds.value.filter(id => id !== defaultFormId.value)]
    const saved = await updateBookingSettings({
        facilityId: props.facilityId,
        allowedDurations: sortedDurations.value,
        defaultDuration: defaultDuration.value,
        formDefinitionIds: ordered
    })
    savingSettings.value = false
    if (saved === null) {
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    settings.value = saved
    toast.success(t('clinicDashboard.saved'))
}

// Interpretation saves on its own: only admins may change it (#205), and it does not need the form above.
async function toggleInterpretation(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) {
        return
    }
    const checkbox = event.target
    savingInterpretation.value = true
    const saved = await setBookingInterpretation({
        facilityId: props.facilityId,
        offersInterpretation: checkbox.checked
    })
    savingInterpretation.value = false
    if (saved === null) {
        checkbox.checked = settings.value?.offersInterpretation ?? false
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    settings.value = saved
    toast.success(t('clinicDashboard.saved'))
}

onMounted(load)
</script>
