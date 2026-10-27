<template>
    <div
        class="flex h-full min-h-0 flex-col gap-3 p-3"
        data-testid="clinic-availability-calendar"
    >
        <div class="flex flex-col gap-2 landscape:flex-row landscape:items-end landscape:justify-between">
            <label class="flex min-w-0 flex-col gap-1 text-sm">
                <span class="font-medium text-primary-text">{{ t('bookingAvailability.clinicLabel') }}</span>
                <select
                    v-model="clinicSiteId"
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
            </p>
        </div>
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
import type { ClinicAvailabilityWindow, ClinicSiteSummary } from '@findadoc/graphql'
import { gql } from 'graphql-request'
import FullCalendar from '@fullcalendar/vue3'
import {
    createClinicAvailabilityWindow,
    deleteClinicAvailabilityWindow,
    fetchClinicAvailabilityWindows
} from '~/utils/booking/staffQuery'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

const { t } = useI18n()

const clinicOptions = ref<Array<{ id: string, name: string }>>([])
const clinicSiteId = ref('')
const windows = ref<ClinicAvailabilityWindow[]>([])
const errorMessage = ref('')
const calendarReady = ref(false)
const rangeFrom = ref(new Date().toISOString())
const rangeTo = ref(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())

const events = computed((): EventInput[] => windows.value.map(window => ({
    id: window.id,
    title: t('bookingAvailability.windowTitle'),
    start: window.startsAt,
    end: window.endsAt,
    editable: false
})))

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
    selectOverlap: false,
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
    if (clinicSiteId.value === '' && clinicOptions.value[0]) {
        clinicSiteId.value = clinicOptions.value[0].id
    }
}

async function reloadWindows(): Promise<void> {
    if (clinicSiteId.value === '') {
        windows.value = []
        return
    }
    errorMessage.value = ''
    windows.value = await fetchClinicAvailabilityWindows(
        clinicSiteId.value,
        rangeFrom.value,
        rangeTo.value
    )
}

async function onSelect(selection: DateSelectArg): Promise<void> {
    if (clinicSiteId.value === '') {
        return
    }
    const created = await createClinicAvailabilityWindow({
        clinicSiteId: clinicSiteId.value,
        startsAt: selection.start.toISOString(),
        endsAt: selection.end.toISOString()
    })
    selection.view.calendar.unselect()
    if (created === null) {
        errorMessage.value = t('bookingAvailability.createFailed')
        return
    }
    await reloadWindows()
}

async function onEventClick(info: EventClickArg): Promise<void> {
    const confirmed = window.confirm(t('bookingAvailability.deleteConfirm'))
    if (!confirmed) {
        return
    }
    const result = await deleteClinicAvailabilityWindow(info.event.id)
    if (result === null || !result.isSuccessful) {
        errorMessage.value = t('bookingAvailability.deleteFailed')
        return
    }
    await reloadWindows()
}

function onDatesSet(info: { start: Date, end: Date }): void {
    rangeFrom.value = info.start.toISOString()
    rangeTo.value = info.end.toISOString()
    void reloadWindows()
}

watch(clinicSiteId, () => {
    void reloadWindows()
})

onMounted(async () => {
    await loadClinicOptions()
    calendarReady.value = true
    await reloadWindows()
})
</script>
