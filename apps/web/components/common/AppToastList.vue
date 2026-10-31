<template>
    <ToastViewport
        class="fixed top-4 left-1/2 z-60 m-0 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 list-none flex-col gap-3 p-0"
        :label="viewportLabel"
    />
    <ToastRoot
        v-for="item in toasts"
        :key="item.id"
        :toast="item"
        :class="[toastClass, item.data?.className]"
    >
        <p
            v-if="showsStatusWord(item)"
            class="text-sm font-semibold"
            :class="statusTextClass(item.status)"
        >
            {{ statusWord(item.status) }}
        </p>
        <ToastTitle
            as="p"
            class="font-semibold"
            :class="showsStatusWord(item) ? 'text-primary-text' : statusTextClass(item.status)"
        />
        <ToastDescription
            as="p"
            class="mt-1 leading-relaxed text-primary-text"
        />
        <ToastAction class="btn btn-secondary btn-sm mt-3" />
        <ToastClose
            :class="dismissClass"
            :aria-label="t('toast.dismiss')"
        >
            <span aria-hidden="true">×</span>
        </ToastClose>
    </ToastRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ToastAction, ToastClose, ToastDescription, ToastRoot, ToastTitle, ToastViewport, useToastManager } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { toastStatusTitleKey, type AppToastData, type ToastStatus } from '~/composables/useAppToast'

const toastClass = [
    'app-toast relative w-full rounded-xl border border-accent-bg border-l-4',
    'bg-secondary-bg p-4 pr-14 shadow-overlay',
    'data-[status=success]:border-l-success data-[status=warning]:border-l-warning',
    'data-[status=danger]:border-l-error data-[status=info]:border-l-info'
].join(' ')

const dismissClass = [
    'absolute top-2 right-2 inline-flex h-11 w-11 items-center justify-center',
    'rounded-lg text-primary-text-muted hover:bg-accent-bg hover:text-primary-text'
].join(' ')

const { t } = useI18n()
const { toasts } = useToastManager<AppToastData>()

// Reka swaps the {hotkey} token. vue-i18n would consume it first, so fill it here.
const viewportLabel = computed(() => t('toast.viewportLabel', { hotkey: 'F8' }))

const STATUS_TEXT_CLASS: Record<ToastStatus, string> = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-error',
    info: 'text-info'
}

function statusWord(status: string | undefined): string {
    const key = toastStatusTitleKey(status)
    return key ? t(key) : ''
}

function statusTextClass(status: string | undefined): string {
    if (status === 'success' || status === 'warning' || status === 'danger' || status === 'info') {
        return STATUS_TEXT_CLASS[status]
    }
    return 'text-primary-text'
}

function showsStatusWord(item: { status?: string, title?: string }): boolean {
    const word = statusWord(item.status)
    return word !== '' && word !== item.title
}
</script>

<style>
/*
 * The toast node is teleported into the viewport, so these rules are global
 * and keyed by class. Swipe offsets come from Reka as CSS variables.
 */
.app-toast[data-state='open']:not([data-swipe]) {
    animation: app-toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.app-toast[data-state='closed']:not([data-swipe='end']) {
    animation: app-toast-out 150ms ease-in;
}

.app-toast[data-swipe='move'] {
    transform: translateX(var(--reka-toast-swipe-move-x));
}

.app-toast[data-swipe='cancel'] {
    transform: translateX(0);
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.app-toast[data-swipe='end'] {
    animation: app-toast-swipe-out 100ms ease-out;
}

@keyframes app-toast-in {
    from { transform: translateY(-0.5rem); }
    to { transform: translateY(0); }
}

@keyframes app-toast-out {
    from { opacity: 1; }
    to { opacity: 0; }
}

@keyframes app-toast-swipe-out {
    from { transform: translateX(var(--reka-toast-swipe-end-x)); }
    to { transform: translateX(100%); }
}
</style>
