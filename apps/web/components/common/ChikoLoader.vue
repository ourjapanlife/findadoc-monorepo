<template>
    <div
        class="flex flex-col items-center justify-center gap-2"
        role="status"
        aria-live="polite"
        data-testid="chiko-loader"
    >
        <div
            class="relative"
            :class="SIZE_CLASSES[props.size].frame"
            aria-hidden="true"
        >
            <!-- Speed lines trail behind Chiko, who faces left. -->
            <span
                v-for="line in SPEED_LINES"
                :key="line.top"
                class="absolute right-0 h-0.5 w-1/4 origin-left animate-chiko-speed rounded-full bg-primary/60"
                :style="{ top: line.top, animationDelay: line.delay }"
            />
            <img
                :src="CHIKO_ILLUSTRATION"
                alt=""
                width="1024"
                height="1024"
                decoding="async"
                class="relative size-full origin-bottom animate-chiko-run object-contain"
            >
            <div class="absolute inset-x-0 -bottom-1 h-0.5 overflow-hidden">
                <div class="flex w-[200%] animate-chiko-ground justify-around">
                    <span
                        v-for="dash in GROUND_DASHES"
                        :key="dash"
                        class="h-0.5 w-[6%] rounded-full bg-border-strong"
                    />
                </div>
            </div>
        </div>
        <span
            :class="[SIZE_CLASSES[props.size].label, { 'sr-only': props.hideLabel }]"
            class="font-medium text-primary-text-muted"
        >{{ props.label ?? t('common.loading') }}</span>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Chiko runs in place while an API request is in flight, so a list that has not
 * loaded yet never reads as "no results". The label is announced to screen readers
 * even when it is hidden; reduced-motion users see a still Chiko.
 */
const props = withDefaults(defineProps<{
    size?: 'sm' | 'md' | 'lg'
    label?: string
    hideLabel?: boolean
}>(), {
    size: 'md',
    label: undefined,
    hideLabel: false
})

const { t } = useI18n()

const CHIKO_ILLUSTRATION = '/illustrations/characters-chiko-therapy-dog-primary.svg'

const SIZE_CLASSES = {
    sm: { frame: 'size-12', label: 'text-xs' },
    md: { frame: 'size-24', label: 'text-sm' },
    lg: { frame: 'size-36', label: 'text-lg' }
} as const

const SPEED_LINES = [
    { top: '38%', delay: '0s' },
    { top: '50%', delay: '0.15s' },
    { top: '62%', delay: '0.3s' }
] as const

const GROUND_DASHES = [1, 2, 3, 4, 5, 6, 7, 8] as const
</script>
