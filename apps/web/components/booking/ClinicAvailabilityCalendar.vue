<template>
    <div
        class="flex h-full min-h-0 flex-col gap-3 p-3"
        data-testid="clinic-availability-calendar"
    >
        <div class="flex flex-col gap-2 landscape:flex-row landscape:items-end landscape:justify-between">
            <label
                v-if="props.facilityId === undefined"
                class="flex min-w-0 flex-col gap-1 text-sm"
            >
                <span class="font-medium text-primary-text">{{ t('bookingAvailability.clinicLabel') }}</span>
                <select
                    v-model="pickedClinicId"
                    class="field max-w-md"
                    data-testid="clinic-availability-clinic"
                >
                    <option
                        v-for="site in clinicOptions"
                        :key="site.id"
                        :value="site.id"
                    >
                        {{ site.name }}
                    </option>
                </select>
            </label>
            <p class="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary-text">
                <svg
                    class="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="10"
                    />
                    <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                    {{ t('bookingAvailability.help') }}
                    {{ t('bookingAvailability.appointmentHelp') }}
                </span>
            </p>
        </div>
        <ul
            class="flex flex-wrap gap-2"
            :aria-label="t('bookingAvailability.legend')"
        >
            <li
                v-for="item in legend"
                :key="item.status"
                class="chip h-7 gap-2 text-xs"
            >
                <span
                    class="inline-block h-2.5 w-2.5 rounded-full border"
                    :style="{ backgroundColor: item.color, borderColor: item.border }"
                    aria-hidden="true"
                />
                {{ item.label }}
            </li>
        </ul>
        <ClientOnly>
            <div class="clinic-calendar card min-h-0 flex-1 overflow-auto p-3 shadow-card">
                <FullCalendar
                    v-if="calendarReady"
                    :options="calendarOptions"
                />
            </div>
            <template #fallback>
                <p class="text-primary-text-muted">
                    {{ t('bookingAvailability.loading') }}
                </p>
            </template>
        </ClientOnly>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
    CalendarOptions,
    DateSelectArg,
    EventClickArg,
    EventInput
} from '@fullcalendar/core'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
    BookingAppointmentStatus,
    type BookingAppointment,
    type ClinicAvailabilityWindow,
    type ClinicSiteSummary
} from '@findadoc/graphql'
import allLocales from '@fullcalendar/core/locales-all'
import { gql } from 'graphql-request'
import FullCalendar from '@fullcalendar/vue3'
import { useAppToast } from '~/composables/useAppToast'
import {
    createClinicAvailabilityWindow,
    deleteClinicAvailabilityWindow,
    fetchClinicCalendar
} from '~/utils/booking/staffQuery'
import { appointmentStatusLabelKey } from '~/utils/booking/appointmentStatus'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

/**
 * Staff paint 30-minute availability; appointments sit on top, coloured by status.
 * With facilityId (the clinic dashboard) the calendar is fixed to that clinic.
 * Without it (moderation) a picker lists the hosted clinics.
 */
const props = defineProps<{
    facilityId?: string
}>()

const emit = defineEmits<{
    'open-booking': [bookingSubmissionId: string]
}>()

const { t, locale } = useI18n()
const toast = useAppToast()

const clinicOptions = ref<Array<{ id: string, name: string }>>([])
const pickedClinicId = ref('')
const clinicId = computed(() => props.facilityId ?? pickedClinicId.value)
const windows = ref<ClinicAvailabilityWindow[]>([])
const appointments = ref<BookingAppointment[]>([])
const calendarReady = ref(false)
const rangeFrom = ref(new Date().toISOString())
const rangeTo = ref(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())

interface EventColors {
    background: string
    border: string
    text: string
}

// Open work is a solid fill; closed outcomes are an outline so they read as finished.
const STATUS_COLORS: Record<BookingAppointmentStatus, EventColors> = {
    [BookingAppointmentStatus.Requested]: {
        background: 'var(--color-warning)',
        border: 'var(--color-warning)',
        text: 'var(--color-primary-text-inverted)'
    },
    [BookingAppointmentStatus.Confirmed]: {
        background: 'var(--color-success)',
        border: 'var(--color-success)',
        text: 'var(--color-primary-text-inverted)'
    },
    [BookingAppointmentStatus.Completed]: {
        background: 'var(--color-accent-bg)',
        border: 'var(--color-primary-text-muted)',
        text: 'var(--color-primary-text)'
    },
    [BookingAppointmentStatus.Declined]: {
        background: 'var(--color-secondary-bg)',
        border: 'var(--color-border-strong)',
        text: 'var(--color-primary-text-muted)'
    },
    [BookingAppointmentStatus.Cancelled]: {
        background: 'var(--color-secondary-bg)',
        border: 'var(--color-border-strong)',
        text: 'var(--color-primary-text-muted)'
    }
}

// Painted open time: a soft brand tint the appointments sit on.
const WINDOW_COLORS: EventColors = {
    background: 'rgb(var(--theme-color-primary) / 0.12)',
    border: 'rgb(var(--theme-color-primary) / 0.35)',
    text: 'var(--color-primary)'
}

const legend = computed(() => [
    {
        status: 'available',
        color: WINDOW_COLORS.background,
        border: WINDOW_COLORS.border,
        label: t('bookingAvailability.windowTitle')
    },
    ...[
        BookingAppointmentStatus.Requested,
        BookingAppointmentStatus.Confirmed,
        BookingAppointmentStatus.Completed,
        BookingAppointmentStatus.Cancelled
    ].map(status => ({
        status,
        color: STATUS_COLORS[status].background,
        border: STATUS_COLORS[status].border,
        label: t(appointmentStatusLabelKey(status))
    }))
])

function isClosed(status: BookingAppointmentStatus): boolean {
    return status === BookingAppointmentStatus.Cancelled || status === BookingAppointmentStatus.Declined
}

const events = computed((): EventInput[] => [
    ...windows.value.map(window => ({
        id: `window:${window.id}`,
        title: t('bookingAvailability.windowTitle'),
        start: window.startsAt,
        end: window.endsAt,
        // A normal event, not display: 'background', so a click can remove it.
        backgroundColor: WINDOW_COLORS.background,
        borderColor: WINDOW_COLORS.border,
        textColor: WINDOW_COLORS.text,
        classNames: ['clinic-calendar-window']
    })),
    ...appointments.value.map(appointment => ({
        id: `appointment:${appointment.id}`,
        title: [
            appointment.patientName ?? t('bookingAvailability.patient'),
            t(appointmentStatusLabelKey(appointment.status))
        ].join(' · '),
        start: appointment.startsAt,
        end: appointment.endsAt,
        backgroundColor: STATUS_COLORS[appointment.status].background,
        borderColor: STATUS_COLORS[appointment.status].border,
        textColor: STATUS_COLORS[appointment.status].text,
        classNames: ['clinic-calendar-appointment', ...(isClosed(appointment.status) ? ['line-through'] : [])],
        extendedProps: { bookingSubmissionId: appointment.bookingSubmissionId }
    }))
])

const calendarOptions = computed((): CalendarOptions => ({
    plugins: [timeGridPlugin, interactionPlugin],
    locales: allLocales,
    // Site codes are `ja_JP`; FullCalendar matches `ja-jp`, then `ja`, then English.
    locale: locale.value.replace('_', '-').toLowerCase(),
    initialView: 'timeGridWeek',
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay'
    },
    slotDuration: '00:30:00',
    snapDuration: '00:30:00',
    slotLabelInterval: '00:30:00',
    allDaySlot: false,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    scrollTime: '08:30:00',
    nowIndicator: true,
    dayHeaderFormat: { weekday: 'short', day: 'numeric' },
    eventTimeFormat: { hour: 'numeric', minute: '2-digit' },
    selectable: true,
    selectMirror: true,
    // No painting over existing availability. Appointments may sit under new availability.
    selectOverlap: event => !event.id.startsWith('window:'),
    events: events.value,
    select: onSelect,
    eventClick: onEventClick,
    datesSet: onDatesSet,
    height: '100%'
}))

async function loadClinicOptions(): Promise<void> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ clinicSites: ClinicSiteSummary[] }>(
        gqlClient.request.bind(gqlClient),
        gql`query ClinicSitesForAvailability {
            clinicSites { id slug status }
        }`,
        {},
        { retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        clinicOptions.value = []
        return
    }
    clinicOptions.value = (response.data.clinicSites ?? []).map(site => ({
        id: site.id,
        name: site.slug
    }))
    if (pickedClinicId.value === '' && clinicOptions.value[0]) {
        pickedClinicId.value = clinicOptions.value[0].id
    }
}

async function reloadCalendar(): Promise<void> {
    if (clinicId.value === '') {
        windows.value = []
        appointments.value = []
        return
    }
    const loaded = await fetchClinicCalendar(clinicId.value, rangeFrom.value, rangeTo.value)
    if (loaded === null) {
        toast.error(t('bookingAvailability.loadFailed'))
        return
    }
    windows.value = loaded.windows
    appointments.value = loaded.appointments
}

async function addWindow(startsAt: string, endsAt: string): Promise<void> {
    const created = await createClinicAvailabilityWindow({ clinicSiteId: clinicId.value, startsAt, endsAt })
    if (created === null) {
        toast.error(t('bookingAvailability.createFailed'))
        return
    }
    await reloadCalendar()
}

async function onSelect(selection: DateSelectArg): Promise<void> {
    selection.view.calendar.unselect()
    if (clinicId.value === '') {
        return
    }
    await addWindow(selection.start.toISOString(), selection.end.toISOString())
}

async function onEventClick(info: EventClickArg): Promise<void> {
    const [kind, id] = info.event.id.split(':')
    if (kind === 'appointment') {
        const bookingSubmissionId = info.event.extendedProps.bookingSubmissionId as string | null
        if (bookingSubmissionId) {
            emit('open-booking', bookingSubmissionId)
        }
        return
    }
    const removed = kind === 'window' ? windows.value.find(item => item.id === id) : undefined
    if (removed === undefined) {
        return
    }
    // Remove at once and offer Undo, instead of a blocking browser dialog.
    const result = await deleteClinicAvailabilityWindow(removed.id)
    if (result === null || !result.isSuccessful) {
        toast.error(t('bookingAvailability.deleteFailed'))
        return
    }
    await reloadCalendar()
    const undo = t('bookingAvailability.undo')
    toast.success(t('bookingAvailability.removed'), {
        action: {
            label: undo,
            altText: undo,
            onClick: () => {
                void addWindow(removed.startsAt, removed.endsAt)
            }
        }
    })
}

function onDatesSet(info: { start: Date, end: Date }): void {
    rangeFrom.value = info.start.toISOString()
    rangeTo.value = info.end.toISOString()
    void reloadCalendar()
}

watch(clinicId, () => {
    void reloadCalendar()
})

onMounted(async () => {
    if (props.facilityId === undefined) {
        await loadClinicOptions()
    }
    calendarReady.value = true
    await reloadCalendar()
})

defineExpose({ reloadCalendar })
</script>

<style>
/*
 * FullCalendar draws its own DOM, so it is themed through its CSS variables and a few
 * selectors under .clinic-calendar. Colours come from the site tokens, so dark mode follows.
 */
.clinic-calendar .fc {
    --fc-border-color: var(--color-accent-bg);
    --fc-page-bg-color: var(--color-secondary-bg);
    --fc-neutral-bg-color: var(--color-primary-bg);
    --fc-today-bg-color: rgb(var(--theme-color-primary) / 0.05);
    --fc-now-indicator-color: var(--color-secondary-hover);
    --fc-highlight-color: rgb(var(--theme-color-primary) / 0.18);
    --fc-button-text-color: var(--color-primary);
    --fc-button-bg-color: var(--color-secondary-bg);
    --fc-button-border-color: var(--color-accent-bg);
    --fc-button-hover-bg-color: rgb(var(--theme-color-primary) / 0.05);
    --fc-button-hover-border-color: var(--color-primary);
    --fc-button-active-bg-color: var(--color-primary);
    --fc-button-active-border-color: var(--color-primary);
    color: var(--color-primary-text);
    font-size: 0.875rem;
}

.clinic-calendar .fc .fc-toolbar.fc-header-toolbar {
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.clinic-calendar .fc .fc-toolbar-title {
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.01em;
}

.clinic-calendar .fc .fc-button {
    height: 2.5rem;
    padding: 0 0.875rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-transform: capitalize;
    box-shadow: none;
}

/* The site's own :focus-visible ring applies; drop FullCalendar's blue glow. */
.clinic-calendar .fc .fc-button:focus,
.clinic-calendar .fc .fc-button-primary:not(:disabled).fc-button-active:focus,
.clinic-calendar .fc .fc-button-primary:not(:disabled):active:focus {
    box-shadow: none;
}

.clinic-calendar .fc .fc-button-primary:hover {
    color: var(--color-primary);
}

.clinic-calendar .fc .fc-button-primary:not(:disabled).fc-button-active,
.clinic-calendar .fc .fc-button-primary:not(:disabled):active {
    color: var(--color-primary-text-inverted);
}

.clinic-calendar .fc .fc-button-primary:disabled {
    color: var(--color-primary-text-muted);
    opacity: 0.6;
}

.clinic-calendar .fc .fc-button-group > .fc-button {
    border-radius: 0.5rem;
}

.clinic-calendar .fc .fc-button-group > .fc-button:not(:first-child) {
    margin-left: 0.25rem;
}

.clinic-calendar .fc .fc-col-header-cell-cushion {
    padding: 0.5rem 0.25rem;
    font-weight: 600;
    color: var(--color-primary-text);
}

.clinic-calendar .fc .fc-day-today .fc-col-header-cell-cushion {
    color: var(--color-primary);
}

.clinic-calendar .fc .fc-timegrid-slot {
    height: 2.25rem;
}

.clinic-calendar .fc .fc-timegrid-slot-minor {
    border-top-style: dashed;
}

.clinic-calendar .fc .fc-timegrid-slot-label-cushion {
    font-size: 0.75rem;
    color: var(--color-primary-text-muted);
}

.clinic-calendar .fc .fc-scrollgrid {
    overflow: hidden;
    border-radius: 0.5rem;
}

.clinic-calendar .fc-timegrid-event {
    padding: 0.125rem 0.25rem;
    border-width: 1px;
    border-left-width: 3px;
    border-radius: 0.375rem;
    box-shadow: none;
    cursor: pointer;
}

.clinic-calendar .clinic-calendar-appointment {
    font-weight: 600;
    box-shadow: var(--shadow-card);
}

.clinic-calendar .clinic-calendar-window:hover {
    background-color: rgb(var(--theme-color-primary) / 0.2) !important;
}
</style>
