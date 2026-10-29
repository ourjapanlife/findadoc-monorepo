<template>
    <div
        class="flex flex-col gap-4"
        data-testid="clinic-booking-requests"
    >
        <div
            class="flex flex-wrap gap-2"
            role="group"
            :aria-label="t('clinicDashboard.statusFilter')"
            data-testid="clinic-booking-status-filter"
        >
            <button
                v-for="option in filterOptions"
                :key="option.value"
                type="button"
                class="chip transition-colors hover:border-primary"
                :class="statusFilter === option.value ? 'chip-primary' : 'text-primary-text-muted'"
                :aria-pressed="statusFilter === option.value"
                @click="statusFilter = option.value"
            >
                {{ option.label }}
            </button>
        </div>

        <ul
            v-if="loading"
            class="flex flex-col gap-3"
            aria-hidden="true"
        >
            <li
                v-for="n in 3"
                :key="n"
                class="card flex animate-pulse items-center gap-4 p-4"
            >
                <span class="h-16 w-16 shrink-0 rounded-lg bg-accent-bg" />
                <span class="flex flex-1 flex-col gap-2">
                    <span class="h-4 w-1/3 rounded bg-accent-bg" />
                    <span class="h-3 w-1/2 rounded bg-accent-bg" />
                </span>
            </li>
        </ul>
        <p
            v-if="loading"
            class="sr-only"
            role="status"
        >
            {{ t('clinicDashboard.loading') }}
        </p>
        <div
            v-else-if="rows.length === 0"
            class="card flex flex-col items-center gap-2 px-6 py-12 text-center"
        >
            <span
                class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
            >
                <svg
                    class="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                    />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
            </span>
            <p class="font-medium text-primary-text-muted">
                {{ t('bookingDashboard.empty') }}
            </p>
        </div>
        <ul
            v-else
            class="flex flex-col gap-3"
        >
            <li
                v-for="row in rows"
                :key="row.id"
            >
                <button
                    type="button"
                    class="card group flex w-full items-center gap-4 p-4 text-left shadow-card transition
                    hover:border-primary hover:shadow-raised"
                    :data-testid="`clinic-booking-row-${row.id}`"
                    @click="emit('open-booking', row.id)"
                >
                    <span
                        class="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg
                        bg-primary/10 text-primary"
                        aria-hidden="true"
                    >
                        <template v-if="row.startsAt">
                            <span class="text-xs font-semibold uppercase tracking-wide">
                                {{ formatPart(row.startsAt, { month: 'short' }) }}
                            </span>
                            <span class="text-2xl leading-none font-bold">
                                {{ formatPart(row.startsAt, { day: 'numeric' }) }}
                            </span>
                            <span class="text-xs">
                                {{ formatPart(row.startsAt, { weekday: 'short' }) }}
                            </span>
                        </template>
                        <span
                            v-else
                            class="text-2xl font-bold"
                        >–</span>
                    </span>

                    <span class="flex min-w-0 flex-1 flex-col gap-1">
                        <span class="truncate font-semibold text-primary-text group-hover:text-primary">
                            {{ row.patientName || t('bookingAvailability.patient') }}
                        </span>
                        <span class="text-sm text-primary-text">
                            <template v-if="row.startsAt">
                                {{ formatWhen(row.startsAt, row.endsAt) }}
                            </template>
                            <template v-else>{{ t('bookingDashboard.noAppointment') }}</template>
                        </span>
                        <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-text-muted">
                            <span>
                                {{ t('bookingDashboard.columns.created') }}: {{ formatCreated(row.createdDate) }}
                            </span>
                            <span
                                v-if="row.hasIdentityUploads"
                                class="rounded-full bg-accent-bg px-2 py-0.5 font-medium text-primary-text"
                            >
                                {{ t('bookingDashboard.identityBadge') }}
                            </span>
                        </span>
                    </span>

                    <span
                        class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
                        :class="statusBadgeClass(row.appointmentStatus)"
                    >
                        {{ row.appointmentStatus
                            ? t(appointmentStatusLabelKey(row.appointmentStatus))
                            : t('bookingDashboard.noAppointment') }}
                    </span>
                    <svg
                        class="hidden h-5 w-5 shrink-0 text-primary-text-muted group-hover:text-primary
                        landscape:block"
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
            </li>
        </ul>

        <div
            v-if="totalCount > PAGE_SIZE"
            class="flex items-center justify-center gap-3"
        >
            <button
                type="button"
                class="btn btn-secondary btn-sm"
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
                class="btn btn-secondary btn-sm"
                :disabled="offset + PAGE_SIZE >= totalCount"
                @click="offset += PAGE_SIZE"
            >
                {{ t('bookingPage.next') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookingAppointmentStatus, type BookingSubmissionListItem } from '@findadoc/graphql'
import { appointmentStatusLabelKey } from '~/utils/booking/appointmentStatus'
import { fetchBookingSubmissions } from '~/utils/booking/staffQuery'
import { JAPAN_TIME_ZONE } from '~/utils/booking/japanTime'

const PAGE_SIZE = 25

// Open work first, then closed outcomes.
const FILTER_ORDER = [
    BookingAppointmentStatus.Requested,
    BookingAppointmentStatus.Confirmed,
    BookingAppointmentStatus.Completed,
    BookingAppointmentStatus.Declined,
    BookingAppointmentStatus.Cancelled
]

const STATUS_BADGE_CLASS: Record<BookingAppointmentStatus, string> = {
    [BookingAppointmentStatus.Requested]: 'border-warning/40 bg-warning/10 text-warning',
    [BookingAppointmentStatus.Confirmed]: 'border-success/40 bg-success/10 text-success',
    [BookingAppointmentStatus.Completed]: 'border-primary/30 bg-primary/10 text-primary',
    [BookingAppointmentStatus.Declined]: 'border-accent-bg bg-primary-bg text-primary-text-muted',
    [BookingAppointmentStatus.Cancelled]: 'border-accent-bg bg-primary-bg text-primary-text-muted'
}

const props = defineProps<{
    facilityId: string
}>()

const emit = defineEmits<{
    'open-booking': [bookingSubmissionId: string]
}>()

const { t, locale } = useI18n()
// New requests are what staff act on first.
const statusFilter = ref<BookingAppointmentStatus | ''>(BookingAppointmentStatus.Requested)
const rows = ref<BookingSubmissionListItem[]>([])
const totalCount = ref(0)
const offset = ref(0)
const loading = ref(true)

const filterOptions = computed(() => [
    ...FILTER_ORDER.map(status => ({ value: status, label: t(appointmentStatusLabelKey(status)) })),
    { value: '' as const, label: t('clinicDashboard.allStatuses') }
])

// Site locale codes are `ja_JP`; Intl wants `ja-JP`.
const intlLocale = computed(() => locale.value.replace('_', '-'))

// Appointment times are the clinic's, so they read as Japan time in any browser zone.
function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(intlLocale.value, { ...options, timeZone: JAPAN_TIME_ZONE })
}

function formatPart(iso: string, options: Intl.DateTimeFormatOptions): string {
    return dateFormat(options).format(new Date(iso))
}

function formatWhen(startsAt: string, endsAt: string | null | undefined): string {
    const start = new Date(startsAt)
    const day = dateFormat({ dateStyle: 'medium' }).format(start)
    const time = dateFormat({ timeStyle: 'short' })
    if (!endsAt) {
        return `${day} · ${time.format(start)}`
    }
    const end = new Date(endsAt)
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
    return `${day} · ${time.formatRange(start, end)} · ${t('bookingPage.durationMinutes', { n: minutes })}`
}

function formatCreated(iso: string): string {
    return dateFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

function statusBadgeClass(status: BookingAppointmentStatus | null | undefined): string {
    return status ? STATUS_BADGE_CLASS[status] : 'border-accent-bg text-primary-text-muted'
}

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
