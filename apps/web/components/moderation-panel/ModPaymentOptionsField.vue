<template>
    <fieldset
        class="mb-3 flex flex-col gap-3"
        data-testid="mod-facility-section-payment"
    >
        <legend class="mb-2 text-sm font-medium text-primary-text">
            {{ t('modFacilitySection.paymentLabel') }}
        </legend>
        <p class="m-0 text-sm text-primary-text-muted">
            {{ t('modFacilitySection.paymentHint') }}
        </p>
        <div
            v-for="paymentType in PAYMENT_TYPES"
            :key="paymentType"
            class="flex flex-col gap-2"
        >
            <label class="flex items-start gap-2 text-sm text-primary-text">
                <input
                    :data-testid="`mod-facility-section-payment-${paymentType}`"
                    class="mt-1"
                    type="checkbox"
                    :checked="hasPaymentType(options, paymentType)"
                    :disabled="!isEditing"
                    @change="onTypeChange(paymentType, $event)"
                >
                <span>{{ paymentTypeLabel(paymentType, t) }}</span>
            </label>
            <div
                v-if="brandsForPaymentType(paymentType).length && hasPaymentType(options, paymentType)"
                class="ml-6 flex flex-wrap gap-x-4 gap-y-2"
            >
                <label
                    v-for="brand in brandsForPaymentType(paymentType)"
                    :key="brand"
                    class="flex items-center gap-2 text-sm text-primary-text"
                >
                    <input
                        :data-testid="`mod-facility-section-payment-${paymentType}-${brand}`"
                        type="checkbox"
                        :checked="hasPaymentBrand(options, paymentType, brand)"
                        :disabled="!isEditing"
                        @change="onBrandChange(paymentType, brand, $event)"
                    >
                    <span>{{ paymentBrandLabel(brand, t) }}</span>
                </label>
            </div>
        </div>
    </fieldset>
</template>

<script setup lang="ts">
import { useI18n } from '#imports'
import type { PaymentOption, PaymentType } from '@findadoc/graphql'
import { PAYMENT_TYPES, type PaymentBrand } from '@findadoc/utils'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import {
    brandsForPaymentType,
    hasPaymentBrand,
    hasPaymentType,
    paymentBrandLabel,
    paymentTypeLabel,
    togglePaymentBrand,
    togglePaymentType
} from '~/utils/paymentOptions'

/**
 * Payment types and card or app brands from the controlled list (#20). Nothing checked is
 * unknown, and the clinic page then shows nothing. Unchecking a type drops its brands.
 */
const { t } = useI18n()
const isEditing = useModerationFormEditing()

const options = defineModel<PaymentOption[]>({ required: true })

function isChecked(event: Event): boolean {
    return event.target instanceof HTMLInputElement && event.target.checked
}

function onTypeChange(paymentType: PaymentType, event: Event) {
    options.value = togglePaymentType(options.value, paymentType, isChecked(event))
}

function onBrandChange(paymentType: PaymentType, brand: PaymentBrand, event: Event) {
    options.value = togglePaymentBrand(options.value, paymentType, brand, isChecked(event))
}
</script>
