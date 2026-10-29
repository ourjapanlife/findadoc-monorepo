<template>
    <div
        class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6"
        data-testid="booking-submission-detail"
    >
        <div class="flex flex-col gap-2 landscape:flex-row landscape:items-center landscape:justify-between">
            <div>
                <p class="text-sm text-primary-text-muted">
                    {{ t('bookingDashboard.requestEyebrow') }}
                </p>
                <h1 class="text-2xl font-semibold text-primary-text">
                    {{ patientName || detail?.clinicName || t('bookingDashboard.detailHeading') }}
                </h1>
            </div>
            <NuxtLink
                :to="props.backTo ?? { path: '/my-page', query: { view: 'bookings' } }"
                class="btn btn-secondary"
                data-testid="booking-detail-back"
            >
                {{ t('bookingDashboard.back') }}
            </NuxtLink>
        </div>

        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('bookingDashboard.loadError') }}
        </p>

        <template v-else-if="detail">
            <section
                v-if="detail.appointmentStatus"
                class="flex flex-col gap-3 rounded-lg border border-accent-bg bg-secondary-bg p-4"
                data-testid="booking-appointment-status"
            >
                <div class="flex flex-wrap items-baseline gap-2">
                    <span class="text-sm text-primary-text-muted">{{ t('bookingDashboard.columns.status') }}</span>
                    <span class="font-semibold">
                        {{ t(appointmentStatusLabelKey(detail.appointmentStatus)) }}
                    </span>
                    <span
                        v-if="detail.cancelledBy"
                        class="text-sm text-primary-text-muted"
                    >
                        · {{ detail.cancelledBy === BookingCancelledBy.Patient
                            ? t('bookingDashboard.cancelledByPatient')
                            : t('bookingDashboard.cancelledByClinic') }}
                    </span>
                </div>
                <p
                    v-if="detail.statusReason"
                    class="whitespace-pre-wrap break-words text-sm"
                >
                    {{ t('bookingDashboard.reasonShown', { reason: detail.statusReason }) }}
                </p>
                <template v-if="actions.length > 0">
                    <label class="flex flex-col gap-1 text-sm">
                        <span>{{ t('bookingDashboard.reasonLabel') }}</span>
                        <textarea
                            v-model="reason"
                            class="field"
                            rows="2"
                            maxlength="500"
                            data-testid="booking-status-reason"
                        />
                    </label>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="next in actions"
                            :key="next"
                            type="button"
                            :class="next === BookingAppointmentStatus.Confirmed ? 'btn btn-primary' : 'btn btn-secondary'"
                            :disabled="updating"
                            :data-testid="`booking-action-${next.toLowerCase()}`"
                            @click="changeStatus(next)"
                        >
                            {{ t(staffActionLabelKey(next)) }}
                        </button>
                    </div>
                </template>
                <p
                    v-if="actionError"
                    class="field-error"
                    role="alert"
                >
                    {{ actionError }}
                </p>
            </section>

            <dl class="grid gap-3 sm:grid-cols-2">
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.clinic') }}
                    </dt>
                    <dd class="font-medium">
                        {{ detail.clinicName }}
                    </dd>
                </div>
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.emailStatus') }}
                    </dt>
                    <dd>
                        {{ statusLabel(detail.status) }}
                    </dd>
                </div>
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.created') }}
                    </dt>
                    <dd>{{ formatToReadableDate(detail.createdDate) }}</dd>
                </div>
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.appointment') }}
                    </dt>
                    <dd>
                        {{ detail.startsAt
                            ? formatToReadableDate(detail.startsAt)
                            : t('bookingDashboard.noAppointment') }}
                    </dd>
                </div>
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.locale') }}
                    </dt>
                    <dd>{{ detail.locale }}</dd>
                </div>
            </dl>

            <section class="flex flex-col gap-3">
                <h2 class="text-lg font-semibold">
                    {{ t('bookingDashboard.answersHeading') }}
                </h2>
                <dl class="flex flex-col gap-3">
                    <div
                        v-for="answer in detail.answers"
                        :key="answer.fieldId"
                        class="rounded-lg border border-accent-bg bg-secondary-bg p-3"
                    >
                        <dt class="text-sm text-primary-text-muted">
                            {{ answerLabel(answer.fieldId) }}
                        </dt>
                        <dd class="whitespace-pre-wrap break-words">
                            {{ answer.value || '—' }}
                        </dd>
                    </div>
                </dl>
            </section>

            <section class="flex flex-col gap-3">
                <h2 class="text-lg font-semibold">
                    {{ t('bookingDashboard.uploadsHeading') }}
                </h2>
                <p class="text-sm text-primary-text-muted">
                    {{ t('bookingDashboard.uploadsRetentionNote') }}
                </p>
                <p
                    v-if="downloadError"
                    class="field-error"
                    role="alert"
                >
                    {{ t('bookingDashboard.downloadFailed') }}
                </p>
                <ul class="flex flex-col gap-2">
                    <li
                        v-for="upload in detail.uploads"
                        :key="upload.id"
                        class="flex flex-col gap-2 rounded-lg border border-accent-bg bg-secondary-bg p-3
                        landscape:flex-row landscape:items-center landscape:justify-between"
                    >
                        <div>
                            <p class="font-medium">
                                {{ upload.fileName }}
                            </p>
                            <p class="text-sm text-primary-text-muted">
                                {{ sensitivityLabel(upload.sensitivity) }}
                                <template v-if="upload.retainUntil">
                                    · {{ t('bookingDashboard.retainUntil', {
                                        date: formatToReadableDate(upload.retainUntil),
                                    }) }}
                                </template>
                                <template v-if="upload.purgedAt">
                                    · {{ t('bookingDashboard.purged') }}
                                </template>
                            </p>
                        </div>
                        <button
                            v-if="upload.purgedAt === null || upload.purgedAt === undefined"
                            type="button"
                            class="btn btn-secondary"
                            :data-testid="`booking-upload-download-${upload.id}`"
                            @click="downloadUpload(upload.id)"
                        >
                            {{ t('bookingDashboard.download') }}
                        </button>
                        <span
                            v-else
                            class="text-sm text-primary-text-muted"
                        >{{ t('bookingDashboard.purged') }}</span>
                    </li>
                </ul>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import {
    BookingAppointmentStatus,
    BookingCancelledBy,
    BookingFieldSensitivity,
    BookingSubmissionStatus,
    type BookingSubmissionDetail as Detail
} from '@findadoc/graphql'
import { formatToReadableDate } from '~/utils/dateUtils'
import {
    actionTakesReason,
    appointmentStatusLabelKey,
    staffActionLabelKey,
    staffActionsFor
} from '~/utils/booking/appointmentStatus'
import {
    fetchBookingSubmissionDetail,
    requestBookingUploadDownloadUrl,
    updateAppointmentStatus
} from '~/utils/booking/staffQuery'

const props = defineProps<{
    bookingId: string
    /** Where Back goes. Moderation's bookings list when unset. */
    backTo?: RouteLocationRaw
}>()

const emit = defineEmits<{
    changed: []
}>()

const { t, te } = useI18n()
const detail = ref<Detail | null>(null)
const loadError = ref(false)
const downloadError = ref(false)
const reason = ref('')
const updating = ref(false)
const actionError = ref('')

const actions = computed(() => staffActionsFor(detail.value?.appointmentStatus))
const patientName = computed(() =>
    detail.value?.answers.find(answer => answer.fieldId === 'fullName')?.value ?? '')

function answerLabel(fieldId: string): string {
    const key = `bookingPage.fields.${fieldId}`
    return te(key) ? t(key) : fieldId
}

async function load(): Promise<void> {
    detail.value = await fetchBookingSubmissionDetail(props.bookingId)
    loadError.value = detail.value === null
}

async function changeStatus(next: BookingAppointmentStatus): Promise<void> {
    const appointmentId = detail.value?.appointmentId
    if (appointmentId === null || appointmentId === undefined) {
        return
    }
    actionError.value = ''
    updating.value = true
    const updated = await updateAppointmentStatus(
        appointmentId,
        next,
        actionTakesReason(next) ? reason.value : ''
    )
    updating.value = false
    // Reload either way: a failure is usually someone else changing it first.
    await load()
    if (updated === null) {
        actionError.value = t('bookingDashboard.actionFailed')
        return
    }
    reason.value = ''
    emit('changed')
}

function statusLabel(status: BookingSubmissionStatus): string {
    if (status === BookingSubmissionStatus.Notified) {
        return t('bookingDashboard.status.notified')
    }
    if (status === BookingSubmissionStatus.FailedNotify) {
        return t('bookingDashboard.status.failedNotify')
    }
    return t('bookingDashboard.status.received')
}

function sensitivityLabel(sensitivity: BookingFieldSensitivity): string {
    if (sensitivity === BookingFieldSensitivity.IdentityDocument) {
        return t('bookingDashboard.sensitivity.identityDocument')
    }
    if (sensitivity === BookingFieldSensitivity.Medical) {
        return t('bookingDashboard.sensitivity.medical')
    }
    return t('bookingDashboard.sensitivity.standard')
}

async function downloadUpload(uploadId: string): Promise<void> {
    downloadError.value = false
    const signed = await requestBookingUploadDownloadUrl(uploadId)
    if (signed === null) {
        downloadError.value = true
        return
    }
    window.open(signed.downloadUrl, '_blank', 'noopener,noreferrer')
}

onMounted(load)
watch(() => props.bookingId, load)
</script>
