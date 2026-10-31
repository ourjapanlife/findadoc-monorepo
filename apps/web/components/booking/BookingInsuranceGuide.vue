<template>
    <div
        v-if="type !== ''"
        class="flex flex-col gap-3 rounded-lg border border-accent-bg bg-primary/5 p-4 text-sm"
        :data-testid="`booking-insurance-guide-${type}`"
    >
        <template v-if="type === 'mynaInsurance'">
            <p class="font-semibold text-primary-text">
                {{ t('bookingPage.insuranceGuide.myna.heading') }}
            </p>
            <ol class="flex list-decimal flex-col gap-1.5 pl-5 text-primary-text">
                <li>{{ t('bookingPage.insuranceGuide.myna.step1') }}</li>
                <li>{{ t('bookingPage.insuranceGuide.myna.step2') }}</li>
                <li>{{ t('bookingPage.insuranceGuide.myna.step3') }}</li>
                <li>{{ t('bookingPage.insuranceGuide.myna.step4') }}</li>
            </ol>
            <a
                href="https://myna.go.jp/"
                target="_blank"
                rel="noopener noreferrer"
                class="w-fit font-semibold text-primary underline"
            >
                {{ t('bookingPage.insuranceGuide.myna.portalLink') }}
            </a>
        </template>
        <p
            v-else
            class="text-primary-text"
        >
            {{ type === 'eligibilityCertificate'
                ? t('bookingPage.insuranceGuide.certificate')
                : t('bookingPage.insuranceGuide.card') }}
        </p>

        <p
            class="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-primary-text"
            role="note"
        >
            <svg
                class="mt-0.5 size-4 shrink-0 text-warning"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4M12 17h.01" />
            </svg>
            <span>
                {{ t('bookingPage.insuranceGuide.noMyNumber') }}
                <template v-if="type === 'mynaInsurance'">
                    {{ t('bookingPage.insuranceGuide.bringCard') }}
                </template>
            </span>
        </p>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * What to upload for the proof of insurance the patient chose (`insuranceType`).
 * A My Number insurance card is shown as a マイナポータル screenshot of the
 * insurance details: Find a Doc never asks for the card or its 12-digit number.
 * The clinic checks the card itself at the visit (オンライン資格確認).
 */
defineProps<{
    type: string
}>()

const { t } = useI18n()
</script>
