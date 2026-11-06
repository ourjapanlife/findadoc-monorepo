<template>
    <p
        v-if="value === JapaneseInsurance.NotAccepted"
        class="m-0 flex flex-col gap-1 text-sm text-primary-text"
        data-testid="japanese-insurance-not-accepted"
    >
        <span class="font-semibold">{{ t('insuranceNote.notAccepted') }}</span>
        <NuxtLink
            :to="guidePath"
            class="w-fit text-primary underline"
            data-testid="japanese-insurance-guide-link"
        >
            {{ t('insuranceNote.guideLink') }}
        </NuxtLink>
    </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { JapaneseInsurance } from '@findadoc/graphql'
import { INSURANCE_GUIDE_PATH } from '~/utils/japaneseInsurance'
import { localizedPath } from '~/utils/localePath'

/**
 * Shown only when a clinic does not take Japanese public health insurance (#18).
 * Taking it is the normal case, so a yes or an unknown shows nothing.
 */
defineProps<{
    value: JapaneseInsurance | null | undefined
}>()

const { t, locale } = useI18n()
const guidePath = computed(() => localizedPath(INSURANCE_GUIDE_PATH, String(locale.value)))
</script>
