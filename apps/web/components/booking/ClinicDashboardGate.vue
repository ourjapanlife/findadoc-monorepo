<template>
    <div
        v-if="authStore.isLoadingAuth"
        class="mx-auto mt-16 text-center text-xl font-semibold text-primary-text"
    >
        {{ t('login.checkingauth') }}
    </div>
    <div
        v-else-if="!authStore.isLoggedIn"
        class="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center"
        data-testid="clinic-dashboard-sign-in"
    >
        <h1 class="text-2xl font-semibold text-primary-text">
            {{ t('clinicDashboard.signInHeading') }}
        </h1>
        <p class="text-primary-text-muted">
            {{ t('clinicDashboard.signInBody') }}
        </p>
        <button
            type="button"
            class="btn btn-primary"
            @click="authStore.login()"
        >
            {{ t('clinicDashboard.signIn') }}
        </button>
    </div>
    <slot v-else />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '~/stores/authStore'

/** Clinic owners and staff sign in here. Sign-in returns to the same dashboard URL. */
const { t } = useI18n()
const authStore = useAuthStore()
</script>
