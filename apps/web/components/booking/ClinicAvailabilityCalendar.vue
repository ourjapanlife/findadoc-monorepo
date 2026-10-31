<template>
    <div
        class="flex flex-col gap-3 p-3 md:h-full md:min-h-0"
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
            <BookingScheduleSelect
                v-model="lane"
                :practitioners="practitioners"
            />
            <p class="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary-text">
                <svg
                    class="mt-0.5 size-4 shrink-0 text-primary"
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
                    {{ mode === 'close' ? t('bookingAvailability.closeHelp') : t('bookingAvailability.help') }}
                    {{ t('bookingAvailability.appointmentHelp') }}
                </span>
            </p>
        </div>
        <div
            class="flex w-fit rounded-lg border border-accent-bg bg-secondary-bg p-1"
            role="radiogroup"
            :aria-label="t('bookingAvailability.modeLabel')"
        >
            <button
                v-for="option in modeOptions"
                :key="option.mode"
                type="button"
                role="radio"
                class="h-9 rounded-md px-3 text-sm font-semibold transition-colors"
                :class="mode === option.mode
                    ? 'bg-primary text-primary-text-inverted'
                    : 'text-primary-text hover:bg-primary/5'"
                :aria-checked="mode === option.mode"
                :data-testid="`clinic-availability-mode-${option.mode}`"
                @click="mode = option.mode"
            >
                {{ option.label }}
            </button>
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
                    class="inline-block size-2.5 rounded-full border"
                    :style="{ backgroundColor: item.color, borderColor: item.border }"
                    aria-hidden="true"
                />
                {{ item.label }}
            </li>
        </ul>
        <p
            class="text-xs text-primary-text-muted"
            data-testid="clinic-availability-time-zone"
        >
            {{ t('bookingPage.japanTimeNote') }}
        </p>
        <ClientOnly>
            <div class="card clinic-calendar h-[50dvh] flex-none overflow-auto p-3 shadow-card md:h-auto md:min-h-0 md:flex-1">
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
import luxonPlugin from '@fullcalendar/luxon3'
import {
    BookingAppointmentStatus,
    type BookingAppointment,
    type BookingPractitioner,
    type ClinicAvailabilityClosure,
    type ClinicAvailabilityWindow,
    type ClinicSiteSummary,
    type ClinicWeeklyHours
} from '@findadoc/graphql'
import allLocales from '@fullcalendar/core/locales-all'
import { gql } from 'graphql-request'
import FullCalendar from '@fullcalendar/vue3'
import BookingScheduleSelect from '~/components/booking/BookingScheduleSelect.vue'
import { useAppToast } from '~/composables/useAppToast'
import {
    createClinicAvailabilityClosure,
    createClinicAvailabilityWindow,
    deleteClinicAvailabilityClosure,
    deleteClinicAvailabilityWindow,
    fetchClinicCalendar,
    fetchClinicPractitioners
} from '~/utils/booking/staffQuery'
import { practitionerName } from '~/utils/booking/practitioners'
import { expandWeeklyHours, JAPAN_TIME_ZONE, jstMidnight, subtractRanges } from '~/utils/booking/japanTime'
import { appointmentStatusLabelKey } from '~/utils/booking/appointmentStatus'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

/**
 * Weekly hours (from Settings) and painted extra windows are open time. Staff close
 * one weekly block by clicking it, or drag in Close mode to close a range or a whole
 * day. Appointments sit on top, coloured by status.
 * The schedule picker edits the clinic's own time or one doctor's. The clinic view
 * shows every appointment; a doctor view shows that doctor's. A clinic-wide closure
 * shows on every schedule, because it closes every doctor.
 * With facilityId (the clinic dashboard) the calendar is fixed to that clinic.
 * Without it (moderation) a picker lists the hosted clinics.
 * The grid is Japan time whatever the browser's zone, so staff abroad paint the clinic's hours.
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
const weeklyHours = ref<ClinicWeeklyHours[]>([])
const closures = ref<ClinicAvailabilityClosure[]>([])
const practitioners = ref<BookingPractitioner[]>([])
// null is the clinic's own schedule.
const lane = ref<string | null>(null)

const onLane = (row: { practitionerId?: string | null }) => (row.practitionerId ?? null) === lane.value
const laneWindows = computed(() => windows.value.filter(onLane))
const laneWeeklyHours = computed(() => weeklyHours.value.filter(onLane))
const laneClosures = computed(() => closures.value.filter(closure =>
    onLane(closure) || (closure.practitionerId ?? null) === null))
const laneAppointments = computed(() => lane.value === null
    ? appointments.value
    : appointments.value.filter(onLane))

function doctorName(practitionerId: string | null | undefined): string {
    const practitioner = practitioners.value.find(item => item.id === practitionerId)
    return practitioner === undefined ? '' : practitionerName(practitioner.names, locale.value)
}
type CalendarMode = 'open' | 'close'
const mode = ref<CalendarMode>('open')
const modeOptions = computed(() => [
    { mode: 'open' as const, label: t('bookingAvailability.modeOpen') },
    { mode: 'close' as const, label: t('bookingAvailability.modeClose') }
])
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

// Usual weekly hours: a lighter tint than painted extra time.
const WEEKLY_COLORS: EventColors = {
    background: 'rgb(var(--theme-color-primary) / 0.07)',
    border: 'rgb(var(--theme-color-primary) / 0.25)',
    text: 'var(--color-primary)'
}

const CLOSURE_COLORS: EventColors = {
    background: 'var(--color-secondary-bg)',
    border: 'var(--color-border-strong)',
    text: 'var(--color-primary-text-muted)'
}

const legend = computed(() => [
    {
        status: 'weekly',
        color: WEEKLY_COLORS.background,
        border: WEEKLY_COLORS.border,
        label: t('bookingAvailability.weeklyTitle')
    },
    {
        status: 'available',
        color: WINDOW_COLORS.background,
        border: WINDOW_COLORS.border,
        label: t('bookingAvailability.windowTitle')
    },
    {
        status: 'closed',
        color: CLOSURE_COLORS.background,
        border: CLOSURE_COLORS.border,
        label: t('bookingAvailability.closedTitle')
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

// Each weekly block in the visible range, minus the parts a closure covers.
const weeklySegments = computed(() => expandWeeklyHours(laneWeeklyHours.value, rangeFrom.value, rangeTo.value)
    .flatMap(occurrence => subtractRanges(occurrence, laneClosures.value)))

const events = computed((): EventInput[] => [
    ...weeklySegments.value.map(segment => ({
        id: `weekly:${segment.startsAt}|${segment.endsAt}`,
        title: t('bookingAvailability.weeklyTitle'),
        start: segment.startsAt,
        end: segment.endsAt,
        backgroundColor: WEEKLY_COLORS.background,
        borderColor: WEEKLY_COLORS.border,
        textColor: WEEKLY_COLORS.text,
        classNames: ['clinic-calendar-weekly']
    })),
    ...laneClosures.value.map(closure => ({
        id: `closure:${closure.id}`,
        title: closure.reason || t('bookingAvailability.closedTitle'),
        start: closure.startsAt,
        end: closure.endsAt,
        backgroundColor: CLOSURE_COLORS.background,
        borderColor: CLOSURE_COLORS.border,
        textColor: CLOSURE_COLORS.text,
        classNames: ['clinic-calendar-closure']
    })),
    ...laneWindows.value.map(window => ({
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
    ...laneAppointments.value.map(appointment => ({
        id: `appointment:${appointment.id}`,
        title: [
            appointment.patientName ?? t('bookingAvailability.patient'),
            t(appointmentStatusLabelKey(appointment.status)),
            // In the clinic view, say whose schedule the visit is on.
            ...(lane.value === null && doctorName(appointment.practitionerId) !== ''
                ? [doctorName(appointment.practitionerId)]
                : [])
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
    plugins: [timeGridPlugin, interactionPlugin, luxonPlugin],
    timeZone: JAPAN_TIME_ZONE,
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
    // In Close mode the all-day row closes whole days.
    allDaySlot: mode.value === 'close',
    allDayText: t('bookingAvailability.closeDayRow'),
    // The whole day stays reachable. It opens scrolled to the morning.
    scrollTime: '08:30:00',
    nowIndicator: true,
    dayHeaderFormat: { weekday: 'short', day: 'numeric' },
    eventTimeFormat: { hour: 'numeric', minute: '2-digit' },
    selectable: true,
    selectMirror: true,
    // No painting over open time. Closing may cover anything. Appointments may sit under either.
    selectOverlap: event => mode.value === 'close'
      || !(event.id.startsWith('window:') || event.id.startsWith('weekly:')),
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
    weeklyHours.value = loaded.weeklyHours
    closures.value = loaded.closures
}

async function addWindow(
    clinicSiteId: string,
    practitionerId: string | null,
    startsAt: string,
    endsAt: string
): Promise<void> {
    const created = await createClinicAvailabilityWindow({ clinicSiteId, practitionerId, startsAt, endsAt })
    if (created === null) {
        toast.error(t('bookingAvailability.createFailed'))
        return
    }
    await reloadCalendar()
}

async function addClosure(
    closureClinicId: string,
    practitionerId: string | null,
    startsAt: string,
    endsAt: string,
    reason?: string | null
): Promise<void> {
    const created = await createClinicAvailabilityClosure({
        clinicId: closureClinicId,
        practitionerId,
        startsAt,
        endsAt,
        reason
    })
    if (created === null) {
        toast.error(t('bookingAvailability.closeFailed'))
        return
    }
    await reloadCalendar()
    const undo = t('bookingAvailability.undo')
    toast.success(t('bookingAvailability.closed'), {
        action: {
            label: undo,
            altText: undo,
            onClick: () => {
                void removeClosure(created, false)
            }
        }
    })
}

async function removeClosure(closure: ClinicAvailabilityClosure, offerUndo: boolean): Promise<void> {
    const removedFromClinicId = clinicId.value
    const result = await deleteClinicAvailabilityClosure(closure.id)
    if (result === null || !result.isSuccessful) {
        toast.error(t('bookingAvailability.deleteFailed'))
        return
    }
    await reloadCalendar()
    if (!offerUndo) {
        return
    }
    const undo = t('bookingAvailability.undo')
    toast.success(t('bookingAvailability.reopened'), {
        action: {
            label: undo,
            altText: undo,
            onClick: () => {
                void addClosure(
                    removedFromClinicId,
                    closure.practitionerId ?? null,
                    closure.startsAt,
                    closure.endsAt,
                    closure.reason
                )
            }
        }
    })
}

/** An all-day pick is Japan dates ('YYYY-MM-DD'); it closes those whole days. */
function allDayRange(selection: DateSelectArg): { startsAt: string, endsAt: string } {
    return {
        startsAt: jstMidnight(selection.startStr.slice(0, 10)).toISOString(),
        endsAt: jstMidnight(selection.endStr.slice(0, 10)).toISOString()
    }
}

async function onSelect(selection: DateSelectArg): Promise<void> {
    selection.view.calendar.unselect()
    if (clinicId.value === '') {
        return
    }
    if (mode.value === 'close') {
        const range = selection.allDay
            ? allDayRange(selection)
            : { startsAt: selection.start.toISOString(), endsAt: selection.end.toISOString() }
        await addClosure(clinicId.value, lane.value, range.startsAt, range.endsAt)
        return
    }
    await addWindow(clinicId.value, lane.value, selection.start.toISOString(), selection.end.toISOString())
}

async function onEventClick(info: EventClickArg): Promise<void> {
    // Split on the first colon only: a weekly id carries ISO timestamps, which have colons of their own.
    const separator = info.event.id.indexOf(':')
    const kind = separator === -1 ? info.event.id : info.event.id.slice(0, separator)
    const id = separator === -1 ? undefined : info.event.id.slice(separator + 1)
    if (kind === 'appointment') {
        const bookingSubmissionId = info.event.extendedProps.bookingSubmissionId as string | null
        if (bookingSubmissionId) {
            emit('open-booking', bookingSubmissionId)
        }
        return
    }
    if (kind === 'weekly' && id !== undefined) {
        // Clicking a weekly block closes that one occurrence.
        const [startsAt, endsAt] = id.split('|')
        if (startsAt !== undefined && endsAt !== undefined) {
            await addClosure(clinicId.value, lane.value, startsAt, endsAt)
        }
        return
    }
    if (kind === 'closure') {
        const closure = closures.value.find(item => item.id === id)
        if (closure !== undefined) {
            await removeClosure(closure, true)
        }
        return
    }
    const removed = kind === 'window' ? windows.value.find(item => item.id === id) : undefined
    if (removed === undefined) {
        return
    }
    // Remove at once and offer Undo, instead of a blocking browser dialog. Undo restores to
    // this clinic even if moderation has switched to another one since.
    const removedFromClinicId = clinicId.value
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
                void addWindow(removedFromClinicId, removed.practitionerId ?? null, removed.startsAt, removed.endsAt)
            }
        }
    })
}

function onDatesSet(info: { start: Date, end: Date }): void {
    rangeFrom.value = info.start.toISOString()
    rangeTo.value = info.end.toISOString()
    void reloadCalendar()
}

async function loadPractitioners(): Promise<void> {
    practitioners.value = clinicId.value === '' ? [] : await fetchClinicPractitioners(clinicId.value)
    if (lane.value !== null && !practitioners.value.some(practitioner => practitioner.id === lane.value)) {
        lane.value = null
    }
}

watch(clinicId, () => {
    void reloadCalendar()
    void loadPractitioners()
})

onMounted(async () => {
    if (props.facilityId === undefined) {
        await loadClinicOptions()
    }
    calendarReady.value = true
    await Promise.all([reloadCalendar(), loadPractitioners()])
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

.clinic-calendar .clinic-calendar-weekly {
    border-style: dashed;
}

.clinic-calendar .clinic-calendar-weekly:hover {
    background-color: rgb(var(--theme-color-primary) / 0.14) !important;
}

.clinic-calendar .clinic-calendar-closure {
    background-image: repeating-linear-gradient(
        135deg,
        transparent 0 6px,
        rgb(var(--theme-color-primary) / 0.08) 6px 12px
    );
}

.clinic-calendar .clinic-calendar-window:hover {
    background-color: rgb(var(--theme-color-primary) / 0.2) !important;
}
</style>
