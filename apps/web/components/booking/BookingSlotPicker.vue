<template>
    <div
        class="flex flex-col gap-4"
        data-testid="booking-slot-picker"
    >
        <div class="flex flex-col">
            <label
                class="field-label"
                :for="durationInputId"
            >
                {{ t('bookingPage.durationLabel') }}
            </label>
            <p class="mb-2 text-sm text-primary-text-muted">
                {{ t('bookingPage.durationHelp') }}
            </p>
            <select
                :id="durationInputId"
                :value="durationMinutes"
                class="field"
                data-testid="booking-slot-duration"
                @change="onDurationChange"
            >
                <option
                    v-for="minutes in allowedDurations"
                    :key="minutes"
                    :value="minutes"
                >
                    {{ t('bookingPage.durationMinutes', { n: minutes }) }}
                </option>
            </select>
        </div>

        <div class="flex flex-col gap-3">
            <div class="flex flex-col">
                <p class="field-label">
                    {{ t('bookingPage.slotLabel') }}
                </p>
                <p class="text-sm text-primary-text-muted">
                    {{ t('bookingPage.slotWeekHelp') }}
                </p>
            </div>

            <div class="flex items-center justify-between gap-2">
                <button
                    type="button"
                    class="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-accent-bg
                    bg-secondary-bg text-primary transition-colors enabled:hover:border-primary
                    disabled:cursor-not-allowed disabled:text-primary-text-muted disabled:opacity-40"
                    :disabled="!canGoBack || loading"
                    :aria-label="t('bookingPage.previousWeek')"
                    data-testid="booking-week-previous"
                    @click="showWeek(addDaysToKey(weekStart, -7))"
                >
                    <svg
                        class="size-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <p
                    class="text-center font-semibold text-primary-text"
                    aria-live="polite"
                    data-testid="booking-week-title"
                >
                    {{ weekTitle }}
                </p>
                <button
                    type="button"
                    class="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-accent-bg
                    bg-secondary-bg text-primary transition-colors enabled:hover:border-primary
                    disabled:cursor-not-allowed disabled:text-primary-text-muted disabled:opacity-40"
                    :disabled="!canGoForward || loading"
                    :aria-label="t('bookingPage.nextWeek')"
                    data-testid="booking-week-next"
                    @click="showWeek(addDaysToKey(weekStart, 7))"
                >
                    <svg
                        class="size-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            </div>

            <div
                class="grid grid-cols-7 gap-1"
                role="radiogroup"
                :aria-label="t('bookingPage.dateLabel')"
                :aria-busy="loading"
            >
                <button
                    v-for="day in days"
                    :key="day.key"
                    type="button"
                    role="radio"
                    class="flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-0.5 py-2 transition-colors
                    disabled:cursor-not-allowed"
                    :class="dayClass(day)"
                    :disabled="day.count === 0 || loading"
                    :aria-checked="day.key === selectedDay"
                    :aria-label="day.ariaLabel"
                    :data-testid="`booking-day-${day.key}`"
                    @click="selectedDay = day.key"
                >
                    <span class="text-[0.7rem] font-medium tracking-wide uppercase">{{ day.weekday }}</span>
                    <span class="text-lg/tight font-bold">{{ day.date }}</span>
                    <span
                        class="min-w-6 rounded-full px-1.5 text-center text-[0.7rem]/5 font-semibold"
                        :class="countClass(day)"
                        aria-hidden="true"
                    >{{ day.count > 0 ? day.count : '–' }}</span>
                </button>
            </div>
            <p class="text-xs text-primary-text-muted">
                {{ t('bookingPage.japanTimeNote') }}
            </p>

            <div
                v-if="loading"
                class="text-sm text-primary-text-muted"
            >
                {{ t('bookingPage.slotLoading') }}
            </div>
            <div
                v-else-if="weekStarts.length === 0"
                class="flex flex-col items-start gap-2 rounded-lg border border-dashed border-accent-bg p-4"
                data-testid="booking-slot-empty"
            >
                <p class="text-sm text-primary-text-muted">
                    {{ nextOpenDay === null ? t('bookingPage.slotEmptyAhead') : t('bookingPage.slotEmptyWeek') }}
                </p>
                <button
                    v-if="nextOpenDay !== null"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-testid="booking-slot-next-available"
                    @click="jumpTo(nextOpenDay)"
                >
                    {{ t('bookingPage.nextAvailable', { date: longDay(nextOpenDay) }) }}
                </button>
            </div>
            <div
                v-else-if="selectedDay !== null"
                class="flex flex-col gap-2"
            >
                <p class="text-sm font-semibold text-primary-text">
                    {{ longDay(selectedDay) }}
                </p>
                <div class="grid grid-cols-3 gap-2 landscape:grid-cols-4">
                    <button
                        v-for="start in dayStarts"
                        :key="start"
                        type="button"
                        class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                        :class="modelValue === start
                            ? 'border-primary bg-primary text-primary-text-inverted'
                            : 'border-accent-bg bg-secondary-bg text-primary-text hover:border-primary'"
                        :aria-pressed="modelValue === start"
                        :data-testid="`booking-slot-${start}`"
                        @click="emit('update:modelValue', start)"
                    >
                        {{ formatTime(start) }}
                        <span
                            v-if="viewerTime(start) !== null"
                            class="block text-xs font-normal opacity-80"
                            :data-testid="`booking-slot-local-${start}`"
                        >
                            {{ t('bookingPage.yourTime', { time: viewerTime(start) }) }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Locale } from '@findadoc/graphql'
import { resolveDuration } from '~/utils/booking/durations'
import { fetchAvailableBookingStarts } from '~/utils/booking/formQuery'
import {
    addDaysToKey,
    dateFromKey,
    JAPAN_TIME_ZONE,
    jstDateKey,
    jstMidnight,
    viewerTimeLabel,
    viewerTimeZone,
    weekStartKey
} from '~/utils/booking/japanTime'
import { intlLocale } from '~/utils/intlLocale'

/**
 * A week at a time, Monday to Sunday in Japan time. Each day shows how many
 * starts are open, so the patient sees at once which days to look at. When a
 * week is empty, the picker offers the next day that has times.
 * A patient whose browser is not on Japan time also sees their own time under each start.
 */
const props = defineProps<{
    clinicId: string
    allowedDurations: readonly number[]
    durationMinutes: number
    modelValue: string | null
    initialDay?: string | null
    practitionerId?: string | null
    spokenLanguages?: readonly Locale[]
}>()

const emit = defineEmits<{
    'update:modelValue': [value: string | null]
    'update:durationMinutes': [value: number]
}>()

/** How far ahead "next available" looks. */
const WEEKS_AHEAD = 12

const { t, locale } = useI18n()
const durationInputId = 'booking-slot-duration'

const todayKey = jstDateKey(new Date())
const firstWeek = weekStartKey(todayKey)
const lastWeek = addDaysToKey(firstWeek, WEEKS_AHEAD * 7)

function initialWeek(): string {
    const fromValue = props.modelValue ?? props.initialDay
    if (fromValue && !Number.isNaN(new Date(fromValue).getTime())) {
        const week = weekStartKey(jstDateKey(fromValue))
        if (week >= firstWeek && week <= lastWeek) {
            return week
        }
    }
    return firstWeek
}

const weekStart = ref(initialWeek())
const selectedDay = ref<string | null>(null)
const loading = ref(true)
// Open starts per week start, for the current length, doctor, and languages.
const weeks = ref(new Map<string, string[]>())
const nextOpenDay = ref<string | null>(null)
let loadGeneration = 0

const canGoBack = computed(() => weekStart.value > firstWeek)
const canGoForward = computed(() => weekStart.value < lastWeek)
const weekStarts = computed(() => weeks.value.get(weekStart.value) ?? [])

const startsByDay = computed(() => {
    const byDay = new Map<string, string[]>()
    for (const start of weekStarts.value) {
        const key = jstDateKey(start)
        byDay.set(key, [...(byDay.get(key) ?? []), start])
    }
    return byDay
})

const dayStarts = computed(() => selectedDay.value === null ? [] : startsByDay.value.get(selectedDay.value) ?? [])

function dayFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(intlLocale(locale.value), { ...options, timeZone: 'UTC' })
}

const days = computed(() => {
    const weekday = dayFormat({ weekday: 'short' })
    const date = dayFormat({ day: 'numeric' })
    return Array.from({ length: 7 }, (_, index) => {
        const key = addDaysToKey(weekStart.value, index)
        const count = key < todayKey ? 0 : startsByDay.value.get(key)?.length ?? 0
        return {
            key,
            weekday: weekday.format(dateFromKey(key)),
            date: date.format(dateFromKey(key)),
            count,
            ariaLabel: `${longDay(key)}, ${t('bookingPage.openTimesCount', { n: count })}`
        }
    })
})

const weekTitle = computed(() => {
    const format = dayFormat({ month: 'short', day: 'numeric' })
    return format.formatRange(dateFromKey(weekStart.value), dateFromKey(addDaysToKey(weekStart.value, 6)))
})

type DayCell = { key: string, count: number }

function dayClass(day: DayCell): string {
    if (day.key === selectedDay.value) {
        return 'border-primary bg-primary text-primary-text-inverted'
    }
    const today = day.key === todayKey ? 'ring-2 ring-inset ring-primary/40' : ''
    if (day.count > 0) {
        return `border-primary/35 bg-primary/10 text-primary-text hover:border-primary ${today}`
    }
    return `border-transparent text-primary-text-muted opacity-60 ${today}`
}

function countClass(day: DayCell): string {
    if (day.key === selectedDay.value) {
        return 'bg-white/25'
    }
    return day.count > 0 ? 'bg-primary/15 text-primary' : ''
}

function longDay(key: string): string {
    return dayFormat({ weekday: 'long', month: 'long', day: 'numeric' }).format(dateFromKey(key))
}

function formatTime(iso: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale.value), {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: JAPAN_TIME_ZONE
    }).format(new Date(iso))
}

// Starts only render after the client has fetched them, so this is the browser's zone.
const viewerZone = viewerTimeZone()

function viewerTime(iso: string): string | null {
    return viewerTimeLabel(iso, intlLocale(locale.value), viewerZone)
}

function onDurationChange(event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) {
        return
    }
    emit('update:durationMinutes', resolveDuration(Number(target.value), props.allowedDurations))
}

async function fetchWeek(week: string): Promise<string[]> {
    const cached = weeks.value.get(week)
    if (cached !== undefined) {
        return cached
    }
    const starts = await fetchAvailableBookingStarts(
        props.clinicId,
        jstMidnight(week).toISOString(),
        jstMidnight(addDaysToKey(week, 7)).toISOString(),
        props.durationMinutes,
        { practitionerId: props.practitionerId, spokenLanguages: props.spokenLanguages }
    )
    // Starts already past are not offered, even if the clinic has not answered for them.
    const upcoming = starts.filter(start => new Date(start).getTime() > Date.now())
    weeks.value = new Map(weeks.value).set(week, upcoming)
    return upcoming
}

/** The first day after this week that has a start, looking up to WEEKS_AHEAD weeks out. */
async function findNextOpenDay(after: string, generation: number): Promise<string | null> {
    for (let week = addDaysToKey(after, 7); week <= lastWeek; week = addDaysToKey(week, 7)) {
        const starts = await fetchWeek(week)
        if (generation !== loadGeneration) {
            return null
        }
        if (starts.length > 0) {
            return jstDateKey(starts[0]!)
        }
    }
    return null
}

function pickDay(): void {
    const keep = props.modelValue === null ? undefined : jstDateKey(props.modelValue)
    const openDays = [...startsByDay.value.keys()].filter(key => key >= todayKey)
    selectedDay.value = keep !== undefined && openDays.includes(keep) ? keep : openDays[0] ?? null
}

/** False when a newer load replaced this one before it finished, so the caller must not act on it. */
async function showWeek(week: string, options: { jumpWhenEmpty?: boolean } = {}): Promise<boolean> {
    const generation = ++loadGeneration
    weekStart.value = week
    loading.value = true
    nextOpenDay.value = null
    const starts = await fetchWeek(week)
    if (generation !== loadGeneration) {
        return false
    }
    if (starts.length === 0) {
        nextOpenDay.value = await findNextOpenDay(week, generation)
        if (generation !== loadGeneration) {
            return false
        }
        // On first load, open the first week that has times instead of an empty one.
        if (options.jumpWhenEmpty === true && nextOpenDay.value !== null) {
            weekStart.value = weekStartKey(nextOpenDay.value)
            nextOpenDay.value = null
        }
    }
    pickDay()
    loading.value = false
    return true
}

function jumpTo(day: string): void {
    void showWeek(weekStartKey(day)).then(current => {
        if (current) {
            selectedDay.value = day
        }
    })
}

// A chosen start that is no longer open (other length, doctor, or language) is cleared.
watch(weekStarts, starts => {
    if (loading.value || props.modelValue === null) {
        return
    }
    const modelWeek = weekStartKey(jstDateKey(props.modelValue))
    if (modelWeek === weekStart.value && !starts.includes(props.modelValue)) {
        emit('update:modelValue', null)
    }
})

watch([
    () => props.durationMinutes,
    () => props.clinicId,
    () => props.practitionerId,
    () => props.spokenLanguages
], async () => {
    weeks.value = new Map()
    const current = await showWeek(weekStart.value, { jumpWhenEmpty: true })
    if (current && props.modelValue !== null && !weekStarts.value.includes(props.modelValue)) {
        emit('update:modelValue', null)
    }
})

onMounted(() => {
    void showWeek(weekStart.value, { jumpWhenEmpty: true })
})
</script>
