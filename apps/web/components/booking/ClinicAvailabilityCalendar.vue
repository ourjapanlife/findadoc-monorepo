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
            <p class="text-sm text-primary-text-muted">
                {{ t('bookingAvailability.help') }}
                {{ t('bookingAvailability.appointmentHelp') }}
            </p>
        </div>
        <ul
            class="flex flex-wrap gap-3 text-xs text-primary-text-muted"
            :aria-label="t('bookingAvailability.legend')"
        >
            <li
                v-for="item in legend"
                :key="item.status"
                class="flex items-center gap-1"
            >
                <span
                    class="inline-block h-3 w-3 rounded-sm"
                    :style="{ backgroundColor: item.color }"
                    aria-hidden="true"
                />
                {{ item.label }}
            </li>
        </ul>
        <p
            v-if="errorMessage"
            class="field-error"
            role="alert"
        >
            {{ errorMessage }}
        </p>
        <ClientOnly>
            <div class="min-h-0 flex-1 overflow-auto rounded-lg border border-accent-bg bg-secondary-bg p-2">
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
import { gql } from 'graphql-request'
import FullCalendar from '@fullcalendar/vue3'
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

const { t } = useI18n()

const clinicOptions = ref<Array<{ id: string, name: string }>>([])
const pickedClinicId = ref('')
const clinicId = computed(() => props.facilityId ?? pickedClinicId.value)
const windows = ref<ClinicAvailabilityWindow[]>([])
const appointments = ref<BookingAppointment[]>([])
const errorMessage = ref('')
const calendarReady = ref(false)
const rangeFrom = ref(new Date().toISOString())
const rangeTo = ref(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())

const STATUS_COLORS: Record<BookingAppointmentStatus, string> = {
    [BookingAppointmentStatus.Requested]: 'var(--color-warning)',
    [BookingAppointmentStatus.Confirmed]: 'var(--color-success)',
    [BookingAppointmentStatus.Completed]: 'var(--color-primary-text-muted)',
    [BookingAppointmentStatus.Declined]: 'var(--color-border-strong)',
    [BookingAppointmentStatus.Cancelled]: 'var(--color-border-strong)'
}

const legend = computed(() => [
    { status: 'available', color: 'var(--color-accent-bg)', label: t('bookingAvailability.windowTitle') },
    ...[
        BookingAppointmentStatus.Requested,
        BookingAppointmentStatus.Confirmed,
        BookingAppointmentStatus.Cancelled
    ].map(status => ({
        status,
        color: STATUS_COLORS[status],
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
        backgroundColor: 'var(--color-accent-bg)',
        borderColor: 'var(--color-accent-bg)',
        textColor: 'var(--color-primary-text-muted)'
    })),
    ...appointments.value.map(appointment => ({
        id: `appointment:${appointment.id}`,
        title: [
            appointment.patientName ?? t('bookingAvailability.patient'),
            t(appointmentStatusLabelKey(appointment.status))
        ].join(' · '),
        start: appointment.startsAt,
        end: appointment.endsAt,
        backgroundColor: STATUS_COLORS[appointment.status],
        borderColor: STATUS_COLORS[appointment.status],
        textColor: 'var(--color-primary-text)',
        classNames: isClosed(appointment.status) ? ['opacity-60', 'line-through'] : [],
        extendedProps: { bookingSubmissionId: appointment.bookingSubmissionId }
    }))
])

const calendarOptions = computed((): CalendarOptions => ({
    plugins: [timeGridPlugin, interactionPlugin],
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
    errorMessage.value = ''
    const loaded = await fetchClinicCalendar(clinicId.value, rangeFrom.value, rangeTo.value)
    if (loaded === null) {
        errorMessage.value = t('bookingAvailability.loadFailed')
        return
    }
    windows.value = loaded.windows
    appointments.value = loaded.appointments
}

async function onSelect(selection: DateSelectArg): Promise<void> {
    selection.view.calendar.unselect()
    if (clinicId.value === '') {
        return
    }
    const created = await createClinicAvailabilityWindow({
        clinicSiteId: clinicId.value,
        startsAt: selection.start.toISOString(),
        endsAt: selection.end.toISOString()
    })
    if (created === null) {
        errorMessage.value = t('bookingAvailability.createFailed')
        return
    }
    await reloadCalendar()
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
    if (kind !== 'window' || id === undefined || !window.confirm(t('bookingAvailability.deleteConfirm'))) {
        return
    }
    const result = await deleteClinicAvailabilityWindow(id)
    if (result === null || !result.isSuccessful) {
        errorMessage.value = t('bookingAvailability.deleteFailed')
        return
    }
    await reloadCalendar()
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
