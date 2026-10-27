<template>
    <div
        class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6"
        data-testid="booking-submission-detail"
    >
        <div class="flex flex-col gap-2 landscape:flex-row landscape:items-center landscape:justify-between">
            <div>
                <p class="text-sm text-primary-text-muted">
                    {{ t('bookingDashboard.readOnly') }}
                </p>
                <h1 class="text-2xl font-semibold text-primary-text">
                    {{ detail?.clinicName ?? t('bookingDashboard.detailHeading') }}
                </h1>
            </div>
            <NuxtLink
                :to="{ path: '/my-page', query: { view: 'bookings' } }"
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
            <dl class="grid gap-3 sm:grid-cols-2">
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.status') }}
                    </dt>
                    <dd class="font-medium">
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
                            {{ answer.fieldId }}
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
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    BookingFieldSensitivity,
    BookingSubmissionStatus,
    type BookingSubmissionDetail as Detail
} from '@findadoc/graphql'
import { formatToReadableDate } from '~/utils/dateUtils'
import {
    fetchBookingSubmissionDetail,
    requestBookingUploadDownloadUrl
} from '~/utils/booking/staffQuery'

const props = defineProps<{
    bookingId: string
}>()

const { t } = useI18n()
const detail = ref<Detail | null>(null)
const loadError = ref(false)

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
    const signed = await requestBookingUploadDownloadUrl(uploadId)
    if (signed === null) {
        loadError.value = true
        return
    }
    window.open(signed.downloadUrl, '_blank', 'noopener,noreferrer')
}

onMounted(async () => {
    detail.value = await fetchBookingSubmissionDetail(props.bookingId)
    loadError.value = detail.value === null
})
</script>
