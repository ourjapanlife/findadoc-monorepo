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

        <ul
            v-else
            class="flex flex-col divide-y divide-accent-bg rounded-lg border border-accent-bg"
        >
            <li
                v-for="day in days"
                :key="day.weekday"
                class="flex flex-col gap-3 p-3 landscape:flex-row landscape:items-start"
                :data-testid="`clinic-weekly-hours-day-${day.weekday}`"
            >
                <label class="flex w-40 shrink-0 cursor-pointer items-center gap-3 pt-2">
                    <input
                        type="checkbox"
                        class="h-5 w-5 accent-primary"
                        :checked="blocksFor(day.weekday).length > 0"
                        :data-testid="`clinic-weekly-hours-open-${day.weekday}`"
                        @change="toggleDay(day.weekday)"
                    >
                    <span class="font-semibold text-primary-text">{{ day.label }}</span>
                </label>
                <p
                    v-if="blocksFor(day.weekday).length === 0"
                    class="pt-2 text-sm text-primary-text-muted"
                >
                    {{ t('clinicDashboard.weeklyHours.closed') }}
                </p>
                <div
                    v-else
                    class="flex flex-1 flex-col gap-2"
                >
                    <div
                        v-for="block in blocksFor(day.weekday)"
                        :key="block.key"
                        class="flex flex-wrap items-center gap-2"
                    >
                        <select
                            v-model.number="block.startMinute"
                            class="field w-28"
                            :aria-label="t('clinicDashboard.weeklyHours.opens', { day: day.label })"
                        >
                            <option
                                v-for="minutes in startOptions"
                                :key="minutes"
                                :value="minutes"
                            >
                                {{ minutesLabel(minutes) }}
                            </option>
                        </select>
                        <span
                            class="text-primary-text-muted"
                            aria-hidden="true"
                        >–</span>
                        <select
                            v-model.number="block.endMinute"
                            class="field w-28"
                            :aria-label="t('clinicDashboard.weeklyHours.closes', { day: day.label })"
                        >
                            <option
                                v-for="minutes in endOptions(block.startMinute)"
                                :key="minutes"
                                :value="minutes"
                            >
                                {{ minutesLabel(minutes) }}
                            </option>
                        </select>
                        <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            :aria-label="t('clinicDashboard.weeklyHours.removeBlock')"
                            @click="removeBlock(block.key)"
                        >
                            {{ t('clinicDashboard.weeklyHours.removeBlock') }}
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="btn btn-ghost btn-sm text-primary"
                            @click="addBlock(day.weekday)"
                        >
                            {{ t('clinicDashboard.weeklyHours.addBlock') }}
                        </button>
                        <button
                            v-if="day.weekday === 1"
                            type="button"
                            class="btn btn-ghost btn-sm text-primary"
                            data-testid="clinic-weekly-hours-copy"
                            @click="copyToWeekdays"
                        >
                            {{ t('clinicDashboard.weeklyHours.copyToWeekdays') }}
                        </button>
                    </div>
                </div>
            </li>
        </ul>

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
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingPractitioner, ClinicWeeklyHours } from '@findadoc/graphql'
import BookingScheduleSelect from '~/components/booking/BookingScheduleSelect.vue'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import { addDaysToKey, dateFromKey, minutesLabel } from '~/utils/booking/japanTime'
import { intlLocale } from '~/utils/intlLocale'
import { fetchClinicPractitioners, fetchClinicWeeklyHours, setClinicWeeklyHours } from '~/utils/booking/staffQuery'

/**
 * The usual week in Japan time (#162), for the clinic or one doctor. Open starts
 * are these hours plus painted windows on the calendar, minus closures and held
 * appointments. A doctor with a week of their own is booked separately.
 */
const props = defineProps<{
    facilityId: string
}>()

const { t, locale } = useI18n()
const toast = useAppToast()

type EditableBlock = { key: number, weekday: number, startMinute: number, endMinute: number }

const STEP = 30
const DAY_MINUTES = 24 * 60
const DEFAULT_BLOCK = { startMinute: 9 * 60, endMinute: 17 * 60 }
// 1 January 2024 was a Monday.
const MONDAY_KEY = '2024-01-01'

const blocks = ref<EditableBlock[]>([])
const savedRows = ref<ClinicWeeklyHours[]>([])
const practitioners = ref<BookingPractitioner[]>([])
// null is the clinic's own week.
const lane = ref<string | null>(null)
const loadError = ref(false)
const saving = ref(false)
let nextKey = 0

const startOptions = Array.from({ length: DAY_MINUTES / STEP }, (_, index) => index * STEP)

function endOptions(startMinute: number): number[] {
    return Array.from({ length: DAY_MINUTES / STEP }, (_, index) => (index + 1) * STEP)
        .filter(minutes => minutes > startMinute)
}

const days = computed(() => {
    const format = new Intl.DateTimeFormat(intlLocale(locale.value), { weekday: 'long', timeZone: 'UTC' })
    return [1, 2, 3, 4, 5, 6, 7].map(weekday => ({
        weekday,
        label: format.format(dateFromKey(addDaysToKey(MONDAY_KEY, weekday - 1)))
    }))
})

function blocksFor(weekday: number): EditableBlock[] {
    return blocks.value
        .filter(block => block.weekday === weekday)
        .sort((a, b) => a.startMinute - b.startMinute)
}

// A start moved past its end drags the end along, so a block never reads backwards.
watch(blocks, list => {
    for (const block of list) {
        if (block.endMinute <= block.startMinute) {
            block.endMinute = Math.min(block.startMinute + STEP, DAY_MINUTES)
        }
    }
}, { deep: true })

const invalid = computed(() => [1, 2, 3, 4, 5, 6, 7].some(weekday => {
    const sorted = blocksFor(weekday)
    return sorted.some((block, index) => index > 0 && block.startMinute < sorted[index - 1]!.endMinute)
}))

function newBlock(weekday: number, startMinute: number, endMinute: number): EditableBlock {
    nextKey += 1
    return { key: nextKey, weekday, startMinute, endMinute }
}

function addBlock(weekday: number): void {
    const last = blocksFor(weekday).at(-1)
    const startMinute = last === undefined ? DEFAULT_BLOCK.startMinute : Math.min(last.endMinute + 60, DAY_MINUTES - STEP)
    const endMinute = last === undefined ? DEFAULT_BLOCK.endMinute : Math.min(startMinute + 4 * 60, DAY_MINUTES)
    blocks.value.push(newBlock(weekday, startMinute, endMinute))
}

function removeBlock(key: number): void {
    blocks.value = blocks.value.filter(item => item.key !== key)
}

function toggleDay(weekday: number): void {
    if (blocksFor(weekday).length > 0) {
        blocks.value = blocks.value.filter(item => item.weekday !== weekday)
        return
    }
    addBlock(weekday)
}

function copyToWeekdays(): void {
    const monday = blocksFor(1)
    blocks.value = [
        ...blocks.value.filter(item => item.weekday === 1 || item.weekday > 5),
        ...[2, 3, 4, 5].flatMap(weekday => monday.map(item => newBlock(weekday, item.startMinute, item.endMinute)))
    ]
}

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
        hours: blocks.value.map(item => ({
            weekday: item.weekday,
            startMinute: item.startMinute,
            endMinute: item.endMinute
        }))
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
