<template>
    <div
        class="flex flex-col gap-2"
        data-testid="booking-slot-picker"
    >
        <label class="field-label">
            {{ t('bookingPage.slotLabel') }}
            <span class="ml-1 font-normal text-primary-text-muted">({{ t('bookingPage.optional') }})</span>
        </label>
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
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAvailableBookingStarts } from '~/utils/booking/staffQuery'

const props = defineProps<{
    clinicSiteId: string
    modelValue: string | null
}>()

const emit = defineEmits<{
    'update:modelValue': [value: string | null]
}>()

const { t, locale } = useI18n()
const starts = ref<string[]>([])
const loading = ref(true)

function formatSlot(iso: string): string {
    return new Intl.DateTimeFormat(locale.value || 'en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(iso))
}

onMounted(async () => {
    loading.value = true
    const from = new Date()
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000)
    starts.value = await fetchAvailableBookingStarts(
        props.clinicSiteId,
        from.toISOString(),
        to.toISOString()
    )
    loading.value = false
})
</script>
