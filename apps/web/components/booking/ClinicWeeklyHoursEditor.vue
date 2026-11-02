<template>
    <form
        class="card flex flex-col gap-5 p-5 shadow-card landscape:p-6"
        data-testid="clinic-weekly-hours"
        @submit.prevent="save"
    >
        <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold tracking-tight text-primary-text">
                {{ t('clinicDashboard.weeklyHours.heading') }}
            </h2>
            <p class="text-sm text-primary-text-muted">
                {{ t('clinicDashboard.weeklyHours.help') }}
            </p>
        </div>

        <BookingScheduleSelect
            :model-value="lane"
            :practitioners="practitioners"
            @update:model-value="selectLane"
        />
        <p
            v-if="lane !== null"
            class="-mt-2 text-sm text-primary-text-muted"
        >
            {{ t('clinicDashboard.weeklyHours.doctorHelp') }}
        </p>

        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.loadError') }}
        </p>

        <WeeklyHoursFields
            v-else
            v-model:blocks="blocks"
            testid-prefix="clinic-weekly-hours"
        />

        <p
            v-if="invalid"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.weeklyHours.invalid') }}
        </p>

        <div class="flex items-center gap-3 border-t border-accent-bg pt-5">
            <button
                type="submit"
                class="btn btn-primary min-w-40"
                :disabled="saving || loadError || invalid"
                :aria-busy="saving"
                data-testid="clinic-weekly-hours-save"
            >
                <ButtonSpinner v-if="saving" />
                {{ saving ? t('clinicDashboard.saving') : t('clinicDashboard.weeklyHours.save') }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingPractitioner, ClinicWeeklyHours } from '@findadoc/graphql'
import BookingScheduleSelect from '~/components/booking/BookingScheduleSelect.vue'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import WeeklyHoursFields from '~/components/booking/WeeklyHoursFields.vue'
import { blocksOverlap, hoursInput, newBlock, type EditableBlock } from '~/utils/booking/weeklyHoursBlocks'
import { fetchClinicPractitioners, fetchClinicWeeklyHours, setClinicWeeklyHours } from '~/utils/booking/staffQuery'

/**
 * The usual week in Japan time (#162), for the clinic or one doctor. Open starts
 * are these hours plus painted windows on the calendar, minus closures and held
 * appointments. A doctor with a week of their own is booked separately.
 */
const props = defineProps<{
    facilityId: string
}>()

const { t } = useI18n()
const toast = useAppToast()

const blocks = ref<EditableBlock[]>([])
const savedRows = ref<ClinicWeeklyHours[]>([])
const practitioners = ref<BookingPractitioner[]>([])
// null is the clinic's own week.
const lane = ref<string | null>(null)
const loadError = ref(false)
const saving = ref(false)

const invalid = computed(() => blocksOverlap(blocks.value))

function showLane(): void {
    blocks.value = savedRows.value
        .filter(row => (row.practitionerId ?? null) === lane.value)
        .map(item => newBlock(item.weekday, item.startMinute, item.endMinute))
}

function selectLane(value: string | null): void {
    lane.value = value
    showLane()
}

async function load(): Promise<void> {
    const [loaded, doctors] = await Promise.all([
        fetchClinicWeeklyHours(props.facilityId),
        fetchClinicPractitioners(props.facilityId)
    ])
    loadError.value = loaded === null
    savedRows.value = loaded ?? []
    practitioners.value = doctors
    showLane()
}

async function save(): Promise<void> {
    if (invalid.value) {
        return
    }
    saving.value = true
    const savedLane = lane.value
    const saved = await setClinicWeeklyHours({
        facilityId: props.facilityId,
        practitionerId: savedLane,
        hours: hoursInput(blocks.value)
    })
    saving.value = false
    if (saved === null) {
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    savedRows.value = [
        ...savedRows.value.filter(row => (row.practitionerId ?? null) !== savedLane),
        ...saved
    ]
    // A doctor's first saved week gives them their own schedule.
    practitioners.value = practitioners.value.map(practitioner => practitioner.id === savedLane
        ? { ...practitioner, hasOwnSchedule: saved.length > 0 || practitioner.hasOwnSchedule }
        : practitioner)
    if (lane.value === savedLane) {
        showLane()
    }
    toast.success(t('clinicDashboard.saved'))
}

onMounted(load)
</script>
