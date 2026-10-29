<template>
    <label
        v-if="practitioners.length > 0"
        class="flex min-w-0 flex-col gap-1 text-sm"
    >
        <span class="font-medium text-primary-text">{{ t('bookingAvailability.scheduleLabel') }}</span>
        <select
            :value="modelValue ?? ''"
            class="field max-w-md"
            data-testid="booking-schedule-select"
            @change="onChange"
        >
            <option value="">
                {{ t('bookingAvailability.scheduleClinic') }}
            </option>
            <option
                v-for="practitioner in sorted"
                :key="practitioner.id"
                :value="practitioner.id"
            >
                {{ optionLabel(practitioner) }}
            </option>
        </select>
    </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingPractitioner } from '@findadoc/graphql'
import { practitionerName, sortedPractitioners } from '~/utils/booking/practitioners'

/**
 * Which schedule staff edit: the clinic's own (null), or one doctor's. A doctor
 * whose week is empty books on clinic time until their own hours are saved.
 */
const props = defineProps<{
    practitioners: readonly BookingPractitioner[]
    modelValue: string | null
}>()

const emit = defineEmits<{
    'update:modelValue': [value: string | null]
}>()

const { t, locale } = useI18n()
const sorted = computed(() => sortedPractitioners(props.practitioners, locale.value))

function optionLabel(practitioner: BookingPractitioner): string {
    const name = practitionerName(practitioner.names, locale.value)
    return practitioner.hasOwnSchedule ? name : `${name} · ${t('bookingAvailability.scheduleUsesClinic')}`
}

function onChange(event: Event): void {
    const target = event.target
    if (target instanceof HTMLSelectElement) {
        emit('update:modelValue', target.value === '' ? null : target.value)
    }
}
</script>
