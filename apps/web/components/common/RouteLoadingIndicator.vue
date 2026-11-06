<template>
    <div
        class="pointer-events-none"
        data-testid="route-loading"
    >
        <div
            class="fixed top-0 left-0 z-70 h-1 origin-left bg-linear-to-r from-primary to-secondary
                transition-[width,opacity] duration-200 ease-soft"
            :class="loading ? 'opacity-100' : 'opacity-0'"
            :style="{ width: `${progress}%` }"
            data-testid="route-loading-bar"
            aria-hidden="true"
        />
        <!-- Bottom centre, so it never covers the header navigation. -->
        <div
            class="fixed inset-x-0 bottom-6 z-70 flex justify-center px-4"
            role="status"
            aria-live="polite"
        >
            <div
                v-if="loading && slow"
                class="flex items-center gap-2 rounded-full border border-border-strong bg-primary-bg px-4 py-2
                    text-sm font-medium text-primary-text shadow-raised"
                data-testid="route-loading-pill"
            >
                <SvgHeartIcon
                    class="size-4 text-primary motion-safe:animate-pulse"
                    aria-hidden="true"
                />
                <span>{{ t('common.loading') }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SvgHeartIcon from '~/assets/icons/heart-icon.svg'

/** The route loading bar, and a "Loading" pill once a navigation is slow (#228). */
defineProps<{
    progress: number
    loading: boolean
    slow: boolean
}>()

const { t } = useI18n()
</script>
