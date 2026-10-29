<template>
    <span
        v-if="count > 0"
        class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5
        text-xs font-semibold leading-none text-primary-text-inverted"
        :title="label"
        data-testid="clinic-request-count"
    >
        <span aria-hidden="true">{{ count }}</span>
        <span class="sr-only">{{ label }}</span>
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** Requested appointments still waiting for the clinic. Hidden at zero. */
const props = defineProps<{ count: number }>()

const { t } = useI18n()
const label = computed(() => t('clinicDashboard.requestedCount', { count: props.count }))
</script>
