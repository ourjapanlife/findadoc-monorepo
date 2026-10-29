<template>
    <div
        class="flex flex-col gap-3"
        data-testid="clinic-booking-requests"
    >
        <label class="flex max-w-xs flex-col gap-1 text-sm">
            <span class="font-medium">{{ t('clinicDashboard.statusFilter') }}</span>
            <select
                v-model="statusFilter"
                class="field"
                data-testid="clinic-booking-status-filter"
            >
                <option value="">
                    {{ t('clinicDashboard.allStatuses') }}
                </option>
                <option
                    v-for="status in statuses"
                    :key="status"
                    :value="status"
                >
                    {{ t(appointmentStatusLabelKey(status)) }}
                </option>
            </select>
        </label>

        <p
            v-if="loading"
            class="text-primary-text-muted"
        >
            {{ t('clinicDashboard.loading') }}
        </p>
        <p
            v-else-if="rows.length === 0"
            class="text-primary-text-muted"
        >
            {{ t('bookingDashboard.empty') }}
        </p>
        <ul
            v-else
            class="flex flex-col gap-2"
        >
            <li
                v-for="row in rows"
                :key="row.id"
            >
                <button
                    type="button"
                    class="flex w-full flex-col gap-1 rounded-lg border border-accent-bg bg-secondary-bg p-3
                    text-left hover:border-primary landscape:flex-row landscape:items-center landscape:justify-between"
                    :data-testid="`clinic-booking-row-${row.id}`"
                    @click="emit('open-booking', row.id)"
                >
                    <span class="font-medium">{{ row.patientName || t('bookingAvailability.patient') }}</span>
                    <span class="text-sm">
                        {{ row.startsAt ? formatToReadableDate(row.startsAt) : t('bookingDashboard.noAppointment') }}
                    </span>
                    <span class="text-sm font-semibold">
                        {{ row.appointmentStatus
                            ? t(appointmentStatusLabelKey(row.appointmentStatus))
                            : t('bookingDashboard.noAppointment') }}
                    </span>
                </button>
            </li>
        </ul>

        <div
            v-if="totalCount > PAGE_SIZE"
            class="flex items-center gap-3"
        >
            <button
                type="button"
                class="btn btn-secondary"
                :disabled="offset === 0"
                @click="offset = Math.max(0, offset - PAGE_SIZE)"
            >
                {{ t('bookingPage.previous') }}
            </button>
            <span class="text-sm text-primary-text-muted">
                {{ offset + 1 }}–{{ Math.min(offset + PAGE_SIZE, totalCount) }} / {{ totalCount }}
            </span>
            <button
                type="button"
                class="btn btn-secondary"
                :disabled="offset + PAGE_SIZE >= totalCount"
                @click="offset += PAGE_SIZE"
            >
                {{ t('bookingPage.next') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookingAppointmentStatus, type BookingSubmissionListItem } from '@findadoc/graphql'
import { appointmentStatusLabelKey } from '~/utils/booking/appointmentStatus'
import { fetchBookingSubmissions } from '~/utils/booking/staffQuery'
import { formatToReadableDate } from '~/utils/dateUtils'

const PAGE_SIZE = 25

const props = defineProps<{
    facilityId: string
}>()

const emit = defineEmits<{
    'open-booking': [bookingSubmissionId: string]
}>()

const { t } = useI18n()
const statuses = Object.values(BookingAppointmentStatus)
// New requests are what staff act on first.
const statusFilter = ref<BookingAppointmentStatus | ''>(BookingAppointmentStatus.Requested)
const rows = ref<BookingSubmissionListItem[]>([])
const totalCount = ref(0)
const offset = ref(0)
const loading = ref(true)

async function load(): Promise<void> {
    loading.value = true
    const result = await fetchBookingSubmissions({
        facilityId: props.facilityId,
        appointmentStatus: statusFilter.value === '' ? undefined : statusFilter.value,
        limit: PAGE_SIZE,
        offset: offset.value
    })
    rows.value = result.rows
    totalCount.value = result.totalCount
    loading.value = false
}

watch(statusFilter, () => {
    offset.value = 0
    void load()
})
watch(offset, () => {
    void load()
})
onMounted(load)

defineExpose({ reload: load })
</script>
