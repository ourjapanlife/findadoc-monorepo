<template>
    <ToastProvider
        :toast-manager="appToastManager"
        :duration="TOAST_DURATION_MS"
        :label="t('toast.announceLabel')"
        swipe-direction="right"
    >
        <AppToastList />
    </ToastProvider>
</template>

<script setup lang="ts">
import { ToastProvider } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import AppToastList from '~/components/common/AppToastList.vue'
import { TOAST_DURATION_MS, appToastManager } from '~/composables/useAppToast'

const { t } = useI18n()
</script>
