<template>
    <div
        class="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 md:p-6"
        data-testid="patient-booking-manage"
    >
        <h1 class="text-2xl font-semibold text-primary-text">
            {{ t('patientBooking.heading') }}
        </h1>
        <p
            v-if="loading"
            class="text-primary-text-muted"
        >
            {{ t('clinicDashboard.loading') }}
        </p>
        <p
            v-else-if="booking === null"
            class="field-error"
            role="alert"
            data-testid="patient-booking-not-found"
        >
            {{ t('patientBooking.notFound') }}
        </p>
        <template v-else>
            <dl class="grid gap-3 rounded-lg border border-accent-bg bg-secondary-bg p-4 sm:grid-cols-2">
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.clinic') }}
                    </dt>
                    <dd class="font-medium">
                        {{ booking.clinicName }}
                    </dd>
                </div>
                <div>
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.status') }}
                    </dt>
                    <dd
                        class="font-medium"
                        data-testid="patient-booking-status"
                    >
                        {{ booking.status ? t(appointmentStatusLabelKey(booking.status)) : '—' }}
                    </dd>
                </div>
                <div class="sm:col-span-2">
                    <dt class="text-sm text-primary-text-muted">
                        {{ t('bookingDashboard.columns.appointment') }}
                    </dt>
                    <dd>{{ booking.startsAt ? formatToReadableDate(booking.startsAt) : '—' }}</dd>
                </div>
            </dl>

            <form
                v-if="booking.canCancel"
                class="flex flex-col gap-3"
                @submit.prevent="confirmingCancel = true"
            >
                <label class="flex flex-col gap-1 text-sm">
                    <span>{{ t('patientBooking.reasonLabel') }}</span>
                    <textarea
                        v-model="reason"
                        class="field"
                        rows="2"
                        maxlength="500"
                    />
                </label>
                <div
                    v-if="confirmingCancel"
                    class="flex flex-col gap-2 rounded-lg border border-error p-3"
                    role="alertdialog"
                    :aria-label="t('patientBooking.confirmCancel')"
                >
                    <p>{{ t('patientBooking.confirmCancel') }}</p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="btn btn-primary"
                            :disabled="cancelling"
                            data-testid="patient-booking-confirm-cancel"
                            @click="cancel"
                        >
                            {{ t('patientBooking.yesCancel') }}
                        </button>
                        <button
                            type="button"
                            class="btn btn-secondary"
                            @click="confirmingCancel = false"
                        >
                            {{ t('patientBooking.keep') }}
                        </button>
                    </div>
                </div>
                <button
                    v-else
                    type="submit"
                    class="btn btn-secondary self-start"
                    data-testid="patient-booking-cancel"
                >
                    {{ t('patientBooking.cancel') }}
                </button>
            </form>
            <p
                v-else-if="booking.status === BookingAppointmentStatus.Cancelled"
                role="status"
            >
                {{ t('patientBooking.cancelled') }}
            </p>
            <p
                v-if="cancelError"
                class="field-error"
                role="alert"
            >
                {{ t('patientBooking.cancelFailed') }}
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookingAppointmentStatus, type PatientBookingView } from '@findadoc/graphql'
import { definePageMeta, useHead } from '#imports'
import { appointmentStatusLabelKey } from '~/utils/booking/appointmentStatus'
import { cancelPatientBooking, fetchPatientBooking } from '~/utils/booking/formQuery'
import { formatToReadableDate } from '~/utils/dateUtils'
import { formatPageTitle } from '~/utils/site'

/**
 * `/book/manage#{token}`: the private link from the confirmation email.
 * The token is in the fragment, so it never reaches a server or CDN log.
 */
definePageMeta({
    ssr: false
})

const { t } = useI18n()
const booking = ref<PatientBookingView | null>(null)
const loading = ref(true)
const reason = ref('')
const confirmingCancel = ref(false)
const cancelling = ref(false)
const cancelError = ref(false)
let token = ''

async function cancel(): Promise<void> {
    cancelling.value = true
    cancelError.value = false
    const updated = await cancelPatientBooking(token, reason.value)
    cancelling.value = false
    confirmingCancel.value = false
    if (updated === null) {
        cancelError.value = true
        booking.value = await fetchPatientBooking(token)
        return
    }
    booking.value = updated
}

onMounted(async () => {
    token = window.location.hash.replace(/^#/, '').trim()
    booking.value = token === '' ? null : await fetchPatientBooking(token)
    loading.value = false
})

useHead(() => ({
    title: formatPageTitle(t('patientBooking.heading')),
    meta: [
        { name: 'robots', content: 'noindex', key: 'robots' },
        { name: 'referrer', content: 'no-referrer', key: 'referrer' }
    ]
}))
</script>
