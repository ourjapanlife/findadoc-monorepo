<template>
    <ul class="flex flex-col divide-y divide-accent-bg rounded-lg border border-accent-bg">
        <li
            v-for="day in days"
            :key="day.weekday"
            class="flex flex-col gap-3 p-3 landscape:flex-row landscape:items-start"
            :data-testid="`${testidPrefix}-day-${day.weekday}`"
        >
            <label class="flex w-40 shrink-0 cursor-pointer items-center gap-3 pt-2">
                <input
                    type="checkbox"
                    class="size-5 accent-primary"
                    :checked="blocksFor(day.weekday).length > 0"
                    :data-testid="`${testidPrefix}-open-${day.weekday}`"
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
                    class="flex flex-col gap-2"
                    :data-testid="`${testidPrefix}-block-${day.weekday}`"
                >
                    <div class="flex flex-wrap items-center gap-2">
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
                    <div
                        v-if="withRepeat"
                        class="flex flex-wrap items-end gap-2"
                    >
                        <label class="flex flex-col gap-1 text-sm text-primary-text-muted">
                            {{ t('clinicDashboard.weeklyHours.repeats') }}
                            <select
                                class="field w-56"
                                :value="repeatChoice(block.repeat)"
                                :data-testid="`${testidPrefix}-repeat-${day.weekday}`"
                                @change="setRepeat(block, $event)"
                            >
                                <option
                                    v-for="option in repeatOptions(block, day.label)"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                        <label
                            v-if="block.repeat.recurrence === HoursRecurrence.Interval"
                            class="flex flex-col gap-1 text-sm text-primary-text-muted"
                        >
                            {{ t('clinicDashboard.weeklyHours.startingOn') }}
                            <select
                                v-model="block.repeat.anchorDate"
                                class="field w-44"
                                :data-testid="`${testidPrefix}-anchor-${day.weekday}`"
                            >
                                <option
                                    v-for="dateKey in anchorChoices(block)"
                                    :key="dateKey"
                                    :value="dateKey"
                                >
                                    {{ dateLabel(dateKey) }}
                                </option>
                            </select>
                        </label>
                        <label class="flex flex-col gap-1 text-sm text-primary-text-muted">
                            {{ t('clinicDashboard.weeklyHours.from') }}
                            <input
                                type="date"
                                class="field w-44"
                                :value="block.repeat.startsOn ?? ''"
                                @change="block.repeat.startsOn = dateValue($event)"
                            >
                        </label>
                        <label class="flex flex-col gap-1 text-sm text-primary-text-muted">
                            {{ t('clinicDashboard.weeklyHours.until') }}
                            <input
                                type="date"
                                class="field w-44"
                                :value="block.repeat.endsOn ?? ''"
                                @change="block.repeat.endsOn = dateValue($event)"
                            >
                        </label>
                    </div>
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
                        :data-testid="`${testidPrefix}-copy`"
                        @click="copyToWeekdays"
                    >
                        {{ t('clinicDashboard.weeklyHours.copyToWeekdays') }}
                    </button>
                </div>
            </div>
        </li>
    </ul>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HoursRecurrence } from '@findadoc/graphql'
import { WEEKS_OF_MONTH } from '@findadoc/utils'
import { addDaysToKey, dateFromKey, jstDateKey, minutesLabel } from '~/utils/booking/japanTime'
import {
    DAY_MINUTES,
    HOURS_STEP_MINUTES,
    PICKER_INTERVAL_WEEKS,
    WEEKDAYS,
    anchorOptions,
    blocksForDay,
    newBlock,
    repeatChoice,
    repeatFromChoice,
    repeatLabel,
    repeatOnWeekday,
    type EditableBlock
} from '~/utils/booking/weeklyHoursBlocks'
import { intlLocale } from '~/utils/intlLocale'

/**
 * One week of blocks in Japan time, a row per day. Used for the clinic's or a
 * doctor's week (ClinicWeeklyHoursEditor) and an interpreter's (#205). With
 * withRepeat, each block also picks which weeks it applies to (#203).
 */
const props = defineProps<{
    testidPrefix: string
    withRepeat?: boolean
}>()

const blocks = defineModel<EditableBlock[]>('blocks', { required: true })

const { t, locale } = useI18n()

const DEFAULT_BLOCK = { startMinute: 9 * 60, endMinute: 17 * 60 }
// 1 January 2024 was a Monday.
const MONDAY_KEY = '2024-01-01'

const startOptions = Array.from({ length: DAY_MINUTES / HOURS_STEP_MINUTES }, (_, index) => index * HOURS_STEP_MINUTES)

function endOptions(startMinute: number): number[] {
    return Array.from({ length: DAY_MINUTES / HOURS_STEP_MINUTES }, (_, index) => (index + 1) * HOURS_STEP_MINUTES)
        .filter(minutes => minutes > startMinute)
}

const days = computed(() => {
    const format = new Intl.DateTimeFormat(intlLocale(locale.value), { weekday: 'long', timeZone: 'UTC' })
    return WEEKDAYS.map(weekday => ({
        weekday,
        label: format.format(dateFromKey(addDaysToKey(MONDAY_KEY, weekday - 1)))
    }))
})

const todayKey = jstDateKey(new Date())

function repeatOptions(block: EditableBlock, dayLabel: string): { value: string, label: string }[] {
    const weeks = new Set<number>(PICKER_INTERVAL_WEEKS)
    if (block.repeat.intervalWeeks !== null) {
        weeks.add(block.repeat.intervalWeeks)
    }
    return [
        { value: 'weekly', label: t('clinicDashboard.weeklyHours.everyWeek') },
        ...[...weeks].sort((a, b) => a - b).map(count => ({
            value: `interval:${count}`,
            label: t('clinicDashboard.weeklyHours.everyNWeeks', { count })
        })),
        ...WEEKS_OF_MONTH.map(weekOfMonth => ({
            value: `monthly:${weekOfMonth}`,
            label: repeatLabel(t, { recurrence: HoursRecurrence.MonthlyNth, weekOfMonth }, dayLabel)
        }))
    ]
}

function setRepeat(block: EditableBlock, event: Event): void {
    block.repeat = repeatFromChoice((event.target as HTMLSelectElement).value, block, todayKey)
}

function anchorChoices(block: EditableBlock): string[] {
    const options = anchorOptions(block.weekday, block.repeat.intervalWeeks ?? PICKER_INTERVAL_WEEKS[0], todayKey)
    const anchor = block.repeat.anchorDate
    return anchor === null || options.includes(anchor) ? options : [anchor, ...options]
}

const dateFormat = computed(() => new Intl.DateTimeFormat(intlLocale(locale.value), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
}))

function dateLabel(dateKey: string): string {
    return dateFormat.value.format(dateFromKey(dateKey))
}

function dateValue(event: Event): string | null {
    const value = (event.target as HTMLInputElement).value
    return value === '' ? null : value
}

function blocksFor(weekday: number): EditableBlock[] {
    return blocksForDay(blocks.value, weekday)
}

// A start moved past its end drags the end along, so a block never reads backwards.
watch(blocks, list => {
    for (const block of list) {
        if (block.endMinute <= block.startMinute) {
            block.endMinute = Math.min(block.startMinute + HOURS_STEP_MINUTES, DAY_MINUTES)
        }
    }
}, { deep: true })

function addBlock(weekday: number): void {
    const last = blocksFor(weekday).at(-1)
    const startMinute = last === undefined
        ? DEFAULT_BLOCK.startMinute
        : Math.min(last.endMinute + 60, DAY_MINUTES - HOURS_STEP_MINUTES)
    const endMinute = last === undefined ? DEFAULT_BLOCK.endMinute : Math.min(startMinute + 4 * 60, DAY_MINUTES)
    blocks.value = [...blocks.value, newBlock(weekday, startMinute, endMinute)]
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
        ...[2, 3, 4, 5].flatMap(weekday => monday.map(item => newBlock(
            weekday,
            item.startMinute,
            item.endMinute,
            props.withRepeat ? repeatOnWeekday(item.repeat, 1, weekday) : undefined
        )))
    ]
}
</script>
