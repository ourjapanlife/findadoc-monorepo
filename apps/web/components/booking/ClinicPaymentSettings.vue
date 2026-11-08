<template>
    <form
        class="card flex flex-col gap-6 p-5 shadow-card landscape:p-6"
        novalidate
        data-testid="clinic-payment-settings"
        @submit.prevent="save"
    >
        <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold tracking-tight text-primary-text">
                {{ t('clinicDashboard.payment.heading') }}
            </h2>
            <p class="text-sm text-primary-text-muted">
                {{ t('clinicDashboard.payment.help') }}
            </p>
        </div>

        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.loadError') }}
        </p>

        <div class="flex max-w-xs flex-col gap-1">
            <label
                for="payment-fee"
                class="field-label"
            >
                {{ t('clinicDashboard.payment.fee') }}
            </label>
            <input
                id="payment-fee"
                v-model="draft.fee"
                type="text"
                inputmode="numeric"
                class="field"
                :disabled="readOnly"
                :aria-invalid="feeInvalid"
                aria-describedby="payment-fee-help"
                data-testid="clinic-payment-fee"
            >
            <p
                id="payment-fee-help"
                :class="feeInvalid ? 'field-error' : 'text-sm text-primary-text-muted'"
            >
                {{ feeInvalid ? t('clinicDashboard.payment.feeInvalid') : t('clinicDashboard.payment.feeHelp') }}
            </p>
        </div>

        <fieldset class="flex flex-col gap-3 border-t border-accent-bg pt-5">
            <legend class="field-label">
                {{ t('clinicDashboard.payment.card') }}
            </legend>
            <label
                v-for="mode in CARD_MODES"
                :key="mode.value"
                class="inline-flex w-fit cursor-pointer items-center gap-2 text-sm"
            >
                <input
                    v-model="draft.cardMode"
                    type="radio"
                    name="payment-card-mode"
                    class="size-4 accent-primary"
                    :value="mode.value"
                    :disabled="readOnly"
                    :data-testid="`clinic-payment-card-mode-${mode.value}`"
                >
                {{ t(mode.labelKey) }}
            </label>
            <div
                v-if="draft.cardMode === BookingCardPaymentMode.FixedLink"
                class="flex flex-col gap-1"
            >
                <label
                    for="payment-card-url"
                    class="field-label"
                >
                    {{ t('clinicDashboard.payment.cardUrl') }}
                </label>
                <input
                    id="payment-card-url"
                    v-model="draft.cardUrl"
                    type="url"
                    class="field"
                    maxlength="2048"
                    placeholder="https://"
                    :disabled="readOnly"
                    :aria-invalid="cardUrlInvalid"
                    data-testid="clinic-payment-card-url"
                >
                <p
                    v-if="cardUrlInvalid"
                    class="field-error"
                >
                    {{ t('clinicDashboard.payment.cardUrlInvalid') }}
                </p>
            </div>
        </fieldset>

        <fieldset class="flex flex-col gap-3 border-t border-accent-bg pt-5">
            <legend class="field-label">
                {{ t('clinicDashboard.payment.bank') }}
            </legend>
            <p class="-mt-1 text-sm text-primary-text-muted">
                {{ t('clinicDashboard.payment.bankHelp') }}
            </p>
            <div class="grid gap-3 landscape:grid-cols-2">
                <div
                    v-for="field in BANK_TEXT_FIELDS"
                    :key="field.key"
                    class="flex flex-col gap-1"
                >
                    <label
                        :for="`payment-${field.key}`"
                        class="field-label"
                    >
                        {{ t(field.labelKey) }}
                    </label>
                    <input
                        :id="`payment-${field.key}`"
                        v-model="draft[field.key]"
                        type="text"
                        class="field"
                        lang="ja"
                        :maxlength="field.maxLength"
                        :inputmode="field.key === 'bankAccountNumber' ? 'numeric' : undefined"
                        :disabled="readOnly"
                        :data-testid="`clinic-payment-${field.key}`"
                    >
                </div>
                <div class="flex flex-col gap-1">
                    <label
                        for="payment-bankAccountType"
                        class="field-label"
                    >
                        {{ t('clinicDashboard.payment.bankAccountType') }}
                    </label>
                    <select
                        id="payment-bankAccountType"
                        v-model="draft.bankAccountType"
                        class="field"
                        :disabled="readOnly"
                        data-testid="clinic-payment-bankAccountType"
                    >
                        <option value="">
                            {{ t('clinicDashboard.payment.accountTypeNotSet') }}
                        </option>
                        <option :value="BookingBankAccountType.Ordinary">
                            {{ t('clinicDashboard.payment.accountTypeOrdinary') }}
                        </option>
                        <option :value="BookingBankAccountType.Checking">
                            {{ t('clinicDashboard.payment.accountTypeChecking') }}
                        </option>
                    </select>
                </div>
            </div>
            <p
                v-if="accountNumberInvalid"
                class="field-error"
            >
                {{ t('clinicDashboard.payment.bankAccountNumberInvalid') }}
            </p>
        </fieldset>

        <fieldset class="flex flex-col gap-3 border-t border-accent-bg pt-5">
            <legend class="field-label">
                {{ t('clinicDashboard.payment.payPay') }}
            </legend>
            <p class="-mt-1 text-sm text-primary-text-muted">
                {{ t('clinicDashboard.payment.payPayHelp') }}
            </p>
            <img
                v-if="qrPreview"
                :src="qrPreview"
                :alt="t('clinicDashboard.payment.payPayQrAlt')"
                class="size-48 rounded-lg border border-accent-bg bg-secondary-bg object-contain p-2"
                data-testid="clinic-payment-qr-preview"
            >
            <p
                v-else
                class="text-sm text-primary-text-muted"
            >
                {{ draft.removeQr ? t('clinicDashboard.payment.payPayRemoving') : t('clinicDashboard.payment.payPayNone') }}
            </p>
            <p
                v-if="pendingQrKey"
                class="text-sm font-semibold text-primary"
                role="status"
            >
                {{ t('clinicDashboard.payment.payPayPending') }}
            </p>
            <div
                v-if="!readOnly"
                class="flex flex-wrap items-end gap-3"
            >
                <div class="flex flex-col gap-1">
                    <label
                        for="payment-qr-file"
                        class="field-label"
                    >
                        {{ t('clinicDashboard.payment.payPayFile') }}
                    </label>
                    <input
                        id="payment-qr-file"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="text-sm"
                        :disabled="uploading"
                        data-testid="clinic-payment-qr-file"
                        @change="chooseQr"
                    >
                </div>
                <button
                    v-if="qrPreview"
                    type="button"
                    class="btn btn-secondary"
                    data-testid="clinic-payment-qr-remove"
                    @click="removeQr"
                >
                    {{ t('clinicDashboard.payment.payPayRemove') }}
                </button>
            </div>
            <p
                v-if="qrError"
                class="field-error"
                role="alert"
            >
                {{ qrError }}
            </p>
        </fieldset>

        <div
            v-if="!readOnly"
            class="flex items-center gap-3 border-t border-accent-bg pt-5"
        >
            <button
                type="submit"
                class="btn btn-primary min-w-40"
                :disabled="saving || uploading"
                :aria-busy="saving"
                data-testid="clinic-payment-save"
            >
                <ButtonSpinner v-if="saving" />
                {{ saving ? t('clinicDashboard.saving') : t('clinicDashboard.payment.save') }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookingBankAccountType, BookingCardPaymentMode, type BookingPaymentSettings } from '@findadoc/graphql'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import { putBookingFile } from '~/utils/booking/formQuery'
import { isAcceptedQrFile, isHttpsLink, parseFeeJpy } from '~/utils/booking/paymentSettings'
import {
    createPaymentQrUploadUrl,
    fetchBookingPaymentSettings,
    updateBookingPaymentSettings
} from '~/utils/booking/paymentSettingsQuery'

/**
 * How the clinic takes the initial fee (online consult v2 §3.3): the fee, card, bank transfer,
 * and a PayPay QR. It saves on its own, so the durations form never overwrites it.
 */
const props = defineProps<{
    facilityId: string
}>()

const CARD_MODES = [
    { value: BookingCardPaymentMode.FixedLink, labelKey: 'clinicDashboard.payment.cardFixedLink' },
    { value: BookingCardPaymentMode.SentByStaff, labelKey: 'clinicDashboard.payment.cardSentByStaff' }
] as const

type BankTextKey = 'bankName' | 'bankBranch' | 'bankAccountNumber' | 'bankAccountHolder'

const BANK_TEXT_FIELDS: ReadonlyArray<{ key: BankTextKey, labelKey: string, maxLength: number }> = [
    { key: 'bankName', labelKey: 'clinicDashboard.payment.bankName', maxLength: 100 },
    { key: 'bankBranch', labelKey: 'clinicDashboard.payment.bankBranch', maxLength: 100 },
    { key: 'bankAccountNumber', labelKey: 'clinicDashboard.payment.bankAccountNumber', maxLength: 8 },
    { key: 'bankAccountHolder', labelKey: 'clinicDashboard.payment.bankAccountHolder', maxLength: 100 }
]

const { t } = useI18n()
const toast = useAppToast()

const draft = reactive({
    fee: '',
    cardMode: BookingCardPaymentMode.SentByStaff as BookingCardPaymentMode,
    cardUrl: '',
    bankName: '',
    bankBranch: '',
    bankAccountType: '' as BookingBankAccountType | '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    removeQr: false
})
const saved = ref<BookingPaymentSettings | null>(null)
const loadError = ref(false)
const saving = ref(false)
const uploading = ref(false)
const submitted = ref(false)
const pendingQrKey = ref<string | null>(null)
const localPreview = ref<string | null>(null)
const qrError = ref('')

// The settings tab is for owners and admins, so a clinic with no saved row is editable.
const readOnly = computed(() => saved.value !== null && !saved.value.canManage)
const feeInvalid = computed(() => parseFeeJpy(draft.fee) === undefined)
const cardUrlInvalid = computed(() => {
    const needsLink = submitted.value && draft.cardMode === BookingCardPaymentMode.FixedLink
    return needsLink && !isHttpsLink(draft.cardUrl)
})
const accountNumberInvalid = computed(() => {
    const accountNumber = draft.bankAccountNumber.trim()
    return accountNumber !== '' && !/^[0-9]{1,8}$/.test(accountNumber)
})
const qrPreview = computed(() => {
    if (localPreview.value !== null) {
        return localPreview.value
    }
    return draft.removeQr ? null : saved.value?.payPayQrPreviewUrl ?? null
})

function clearLocalPreview(): void {
    if (localPreview.value !== null) {
        URL.revokeObjectURL(localPreview.value)
    }
    localPreview.value = null
}

function fillDraft(settings: BookingPaymentSettings | null): void {
    saved.value = settings
    draft.fee = settings?.feeJpy === null || settings?.feeJpy === undefined ? '' : String(settings.feeJpy)
    draft.cardMode = settings?.cardMode ?? BookingCardPaymentMode.SentByStaff
    draft.cardUrl = settings?.cardUrl ?? ''
    draft.bankName = settings?.bankName ?? ''
    draft.bankBranch = settings?.bankBranch ?? ''
    draft.bankAccountType = settings?.bankAccountType ?? ''
    draft.bankAccountNumber = settings?.bankAccountNumber ?? ''
    draft.bankAccountHolder = settings?.bankAccountHolder ?? ''
    draft.removeQr = false
    pendingQrKey.value = null
    clearLocalPreview()
}

async function load(): Promise<void> {
    const loaded = await fetchBookingPaymentSettings(props.facilityId)
    loadError.value = loaded === null
    fillDraft(loaded?.settings ?? null)
}

/** Uploads the chosen image right away; the settings keep it only after Save. */
async function chooseQr(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) {
        return
    }
    const input = event.target
    const file = input.files?.[0]
    qrError.value = ''
    if (file === undefined) {
        return
    }
    if (!isAcceptedQrFile(file)) {
        qrError.value = t('clinicDashboard.payment.payPayFileInvalid')
        input.value = ''
        return
    }
    uploading.value = true
    const signed = await createPaymentQrUploadUrl(props.facilityId, file)
    const uploaded = signed !== null && await putBookingFile(signed.uploadUrl, file, signed.headers)
    uploading.value = false
    input.value = ''
    if (!uploaded || signed === null) {
        qrError.value = t('clinicDashboard.payment.payPayUploadFailed')
        return
    }
    clearLocalPreview()
    localPreview.value = URL.createObjectURL(file)
    pendingQrKey.value = signed.objectKey
    draft.removeQr = false
}

function removeQr(): void {
    clearLocalPreview()
    pendingQrKey.value = null
    draft.removeQr = true
}

async function save(): Promise<void> {
    submitted.value = true
    const feeJpy = parseFeeJpy(draft.fee)
    if (feeJpy === undefined || cardUrlInvalid.value || accountNumberInvalid.value) {
        return
    }
    saving.value = true
    const result = await updateBookingPaymentSettings({
        facilityId: props.facilityId,
        cardMode: draft.cardMode,
        cardUrl: draft.cardMode === BookingCardPaymentMode.FixedLink ? draft.cardUrl.trim() : null,
        bankName: draft.bankName.trim() || null,
        bankBranch: draft.bankBranch.trim() || null,
        bankAccountType: draft.bankAccountType === '' ? null : draft.bankAccountType,
        bankAccountNumber: draft.bankAccountNumber.trim() || null,
        bankAccountHolder: draft.bankAccountHolder.trim() || null,
        payPayQrObjectKey: pendingQrKey.value,
        removePayPayQr: draft.removeQr,
        feeJpy
    })
    saving.value = false
    if (result === null) {
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    submitted.value = false
    fillDraft(result)
    toast.success(t('clinicDashboard.saved'))
}

onMounted(load)
onBeforeUnmount(clearLocalPreview)
</script>
