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
                    class="whitespace-pre-wrap wrap-break-word text-sm"
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
                    <dd>{{ languageName(detail.locale, locale) }}</dd>
                </div>
                <div v-if="doctor !== ''">
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.doctor') }}
                    </dt>
                    <dd data-testid="booking-detail-doctor">
                        {{ doctor }}
                    </dd>
                </div>
                <div v-if="detail.spokenLanguages.length > 0">
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.languagesRequested') }}
                    </dt>
                    <dd data-testid="booking-detail-languages">
                        {{ detail.spokenLanguages.map(language => languageName(language, locale)).join(', ') }}
                    </dd>
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
                        <dd class="whitespace-pre-wrap wrap-break-word">
                            {{ answerValue(answer.fieldId, answer.value) }}
                        </dd>
                    </div>
                </dl>
            </section>

            <section
                v-if="detail.uploads.length > 0"
                class="flex flex-col gap-3"
            >
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
                <ul class="flex flex-col gap-3">
                    <li
                        v-for="upload in detail.uploads"
                        :key="upload.id"
                        class="flex flex-col gap-3 rounded-lg border border-accent-bg bg-secondary-bg p-3"
                        :data-testid="`booking-upload-${upload.id}`"
                    >
                        <div class="flex flex-col">
                            <p class="font-medium">
                                {{ answerLabel(upload.fieldId) }}
                            </p>
                            <p class="text-sm text-primary-text-muted">
                                {{ sensitivityLabel(upload.sensitivity) }}
                                <template v-if="upload.retainUntil && !isPurged(upload)">
                                    · {{ t('bookingDashboard.retainUntil', {
                                        date: formatToReadableDate(upload.retainUntil),
                                    }) }}
                                </template>
                            </p>
                        </div>

                        <p
                            v-if="isPurged(upload)"
                            class="rounded-lg border border-dashed border-accent-bg p-4 text-sm text-primary-text-muted"
                        >
                            {{ t('bookingDashboard.purgedNote') }}
                        </p>
                        <template v-else>
                            <button
                                v-if="isImage(upload) && previewUrls[upload.id]"
                                type="button"
                                class="block w-fit max-w-full overflow-hidden rounded-lg border border-accent-bg
                                bg-primary-bg"
                                :aria-label="t('bookingDashboard.previewOf', { name: answerLabel(upload.fieldId) })"
                                @click="previewUpload(upload.id)"
                            >
                                <!-- No fixed size: the photo keeps its own aspect ratio inside the limits. -->
                                <img
                                    :src="previewUrls[upload.id]"
                                    :alt="answerLabel(upload.fieldId)"
                                    class="block h-auto max-h-80 w-auto max-w-full object-contain"
                                    :data-testid="`booking-upload-preview-${upload.id}`"
                                >
                            </button>
                            <div
                                v-else-if="!isImage(upload)"
                                class="flex w-fit items-center gap-2 rounded-lg border border-accent-bg bg-primary-bg
                                px-4 py-3 text-sm font-semibold text-primary-text"
                            >
                                <svg
                                    class="h-5 w-5 text-primary"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 2v6h6" />
                                </svg>
                                {{ upload.contentType === 'application/pdf' ? 'PDF' : upload.contentType }}
                            </div>
                            <p
                                v-if="upload.fileName !== ''"
                                class="break-all text-xs text-primary-text-muted"
                            >
                                {{ upload.fileName }}
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    class="btn btn-secondary btn-sm"
                                    :data-testid="`booking-upload-open-${upload.id}`"
                                    @click="previewUpload(upload.id)"
                                >
                                    {{ t('bookingDashboard.preview') }}
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-secondary btn-sm"
                                    :data-testid="`booking-upload-download-${upload.id}`"
                                    @click="downloadUpload(upload.id)"
                                >
                                    {{ t('bookingDashboard.download') }}
                                </button>
                            </div>
                        </template>
                    </li>
                </ul>
                <p class="text-xs text-primary-text-muted">
                    {{ t('bookingDashboard.downloadNote') }}
                </p>
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
    BookingUploadDisposition,
    type BookingSubmissionDetail as Detail,
    type BookingUploadView
} from '@findadoc/graphql'
import { formatToReadableDate } from '~/utils/dateUtils'
import { languageName } from '~/utils/languageName'
import { practitionerName } from '~/utils/booking/practitioners'
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

const { t, te, locale } = useI18n()
const detail = ref<Detail | null>(null)
const loadError = ref(false)
const downloadError = ref(false)
// Inline URLs for photo previews, by upload id. They expire after a few minutes;
// an image already shown stays on screen, and Preview asks for a fresh one.
const previewUrls = ref<Record<string, string>>({})
const reason = ref('')
const updating = ref(false)
const actionError = ref('')

const actions = computed(() => staffActionsFor(detail.value?.appointmentStatus))
const doctor = computed(() => practitionerName(detail.value?.practitionerNames, locale.value))
const patientName = computed(() =>
    detail.value?.answers.find(answer => answer.fieldId === 'fullName')?.value ?? '')

function answerLabel(fieldId: string): string {
    const key = `bookingPage.fields.${fieldId}`
    return te(key) ? t(key) : fieldId
}

function isPurged(upload: BookingUploadView): boolean {
    return upload.purgedAt !== null && upload.purgedAt !== undefined
}

function isImage(upload: BookingUploadView): boolean {
    return upload.contentType.startsWith('image/')
}

async function loadPreviews(): Promise<void> {
    const images = (detail.value?.uploads ?? []).filter(upload => isImage(upload) && !isPurged(upload))
    const signed = await Promise.all(images.map(upload =>
        requestBookingUploadDownloadUrl(upload.id, BookingUploadDisposition.Inline)))
    const urls: Record<string, string> = {}
    signed.forEach((url, index) => {
        if (url !== null) {
            urls[images[index]!.id] = url.downloadUrl
        }
    })
    previewUrls.value = urls
}

/** A choice answer reads as its label in the staff's language, such as "Health insurance card". */
function answerValue(fieldId: string, value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '—'
    }
    const optionKey = `bookingPage.options.${fieldId}.${value}`
    return te(optionKey) ? t(optionKey) : value
}

async function load(): Promise<void> {
    detail.value = await fetchBookingSubmissionDetail(props.bookingId)
    loadError.value = detail.value === null
    previewUrls.value = {}
    void loadPreviews()
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

/** Opens the file in a new tab. */
async function previewUpload(uploadId: string): Promise<void> {
    downloadError.value = false
    const signed = await requestBookingUploadDownloadUrl(uploadId, BookingUploadDisposition.Inline)
    if (signed === null) {
        downloadError.value = true
        return
    }
    window.open(signed.downloadUrl, '_blank', 'noopener,noreferrer')
}

/** Saves the file. The URL answers with Content-Disposition: attachment, so the page stays put. */
async function downloadUpload(uploadId: string): Promise<void> {
    downloadError.value = false
    const signed = await requestBookingUploadDownloadUrl(uploadId, BookingUploadDisposition.Attachment)
    if (signed === null) {
        downloadError.value = true
        return
    }
    const link = document.createElement('a')
    link.href = signed.downloadUrl
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
}

onMounted(load)
watch(() => props.bookingId, load)
</script>
