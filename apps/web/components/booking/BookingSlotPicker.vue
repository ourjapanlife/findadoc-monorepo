<template>
    <div
        class="flex flex-col gap-3"
        data-testid="booking-slot-picker"
    >
        <label
            class="field-label"
            :for="dateInputId"
        >
            {{ t('bookingPage.dateLabel') }}
        </label>
        <input
            :id="dateInputId"
            v-model="selectedDay"
            class="field"
            type="date"
            :min="minDay"
            data-testid="booking-slot-date"
        >

        <label
            class="field-label"
            :for="durationInputId"
        >
            {{ t('bookingPage.durationLabel') }}
        </label>
        <p class="text-sm text-primary-text-muted">
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

        <p class="field-label">
            {{ t('bookingPage.slotLabel') }}
        </p>
        <p class="text-sm text-primary-text-muted">
            {{ t('bookingPage.slotHelp') }}
        </p>
        <div
            v-if="loading"
            class="text-sm text-primary-text-muted"
        >
            {{ t('bookingPage.slotLoading') }}
        </div>
        <div
            v-else-if="starts.length === 0"
            class="text-sm text-primary-text-muted"
            data-testid="booking-slot-empty"
        >
            {{ t('bookingPage.slotEmpty') }}
        </div>
        <div
            v-else
            class="grid grid-cols-2 gap-2 landscape:grid-cols-4"
        >
            <button
                v-for="start in starts"
                :key="start"
                type="button"
                class="rounded-lg border px-3 py-2 text-sm"
                :class="modelValue === start
                    ? 'border-primary bg-accent-bg/30 font-semibold text-primary-text'
                    : 'border-accent-bg bg-secondary-bg text-primary-text hover:bg-accent-bg/20'"
                :data-testid="`booking-slot-${start}`"
                @click="emit('update:modelValue', start)"
            >
                {{ formatSlot(start) }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { dayRangeUtc, resolveDuration } from '~/utils/booking/durations'
import { fetchAvailableBookingStarts } from '~/utils/booking/formQuery'

const props = defineProps<{
    clinicId: string
    allowedDurations: readonly number[]
    durationMinutes: number
    modelValue: string | null
    initialDay?: string | null
}>()

const emit = defineEmits<{
    'update:modelValue': [value: string | null]
    'update:durationMinutes': [value: number]
}>()

const { t, locale } = useI18n()
const starts = ref<string[]>([])
const loading = ref(true)
const dateInputId = 'booking-slot-date'
const durationInputId = 'booking-slot-duration'

function toDateInput(value: Date): string {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function dayFromIso(iso: string): string {
    return toDateInput(new Date(iso))
}

const today = new Date()
const minDay = toDateInput(today)
const selectedDay = ref(props.initialDay && !Number.isNaN(new Date(props.initialDay).getTime())
    ? dayFromIso(props.initialDay)
    : minDay)

function formatSlot(iso: string): string {
    return new Intl.DateTimeFormat(locale.value || 'en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(iso))
}

function onDurationChange(event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) {
        return
    }
    emit('update:durationMinutes', resolveDuration(Number(target.value), props.allowedDurations))
}

async function loadStarts(): Promise<void> {
    loading.value = true
    const day = selectedDay.value === '' ? minDay : selectedDay.value
    const range = dayRangeUtc(new Date(`${day}T00:00:00`))
    starts.value = await fetchAvailableBookingStarts(
        props.clinicId,
        range.from,
        range.to,
        props.durationMinutes
    )
    if (props.modelValue !== null && !starts.value.includes(props.modelValue)) {
        emit('update:modelValue', null)
    }
    loading.value = false
}

watch([selectedDay, () => props.durationMinutes, () => props.clinicId], () => {
    void loadStarts()
})

onMounted(() => {
    void loadStarts()
})
</script>
