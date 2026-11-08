<template>
    <header
        data-testid="clinic-branded-header"
        class="sticky top-0 z-30 w-full border-b border-accent-bg bg-primary-bg/90 backdrop-blur-md"
    >
        <div class="px-6 landscape:px-12">
            <div class="page-container flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
                <img
                    v-if="logoSrc !== null"
                    :src="logoSrc"
                    :alt="chrome.branding.displayName"
                    class="h-10 w-auto max-w-56 object-contain"
                    data-testid="clinic-branded-logo"
                >
                <p
                    v-else
                    class="min-w-0 text-lg/tight font-semibold text-primary"
                    data-testid="clinic-branded-wordmark"
                >
                    {{ wordmark }}
                </p>
                <div class="flex flex-wrap items-center gap-2">
                    <LocaleSelector v-if="chrome.localeSelector" />
                    <template v-if="chrome.staff && authStore.isLoggedIn">
                        <NuxtLink
                            v-if="chrome.canSwitchClinic"
                            :to="localizedPath('/clinic-dashboard', localeCodeFromPath(route.path))"
                            class="btn btn-secondary"
                            data-testid="clinic-branded-switch-clinic"
                        >
                            {{ t('clinicDashboard.switchClinic') }}
                        </NuxtLink>
                        <button
                            type="button"
                            class="btn btn-secondary"
                            data-testid="clinic-branded-sign-out"
                            @click="logout"
                        >
                            {{ t('topNav.logout') }}
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from '#imports'
import { useAppToast } from '~/composables/useAppToast'
import type { ClinicBrandedChrome } from '~/composables/useClinicBranding'
import { useAuthStore } from '~/stores/authStore'
import { clinicLogoSrc, clinicWordmark } from '~/utils/booking/clinicBranding'
import { localeCodeFromPath, localizedPath } from '~/utils/localePath'

/**
 * The clinic's logo, or its wordmark in the page language (ja on Japanese pages, en on every
 * other). On the dashboard it keeps sign-out and the way back to the clinic picker, which
 * the Find a Doc header carried.
 */
const props = defineProps<{
    chrome: ClinicBrandedChrome
}>()

const { t, locale } = useI18n()
const route = useRoute()
const toast = useAppToast()
const authStore = useAuthStore()

const logoSrc = computed(() => clinicLogoSrc(props.chrome.branding))
const wordmark = computed(() => clinicWordmark(props.chrome.branding, String(locale.value)))

async function logout(): Promise<void> {
    try {
        await authStore.logout()
        toast.success(t('topNav.logoutToast'))
    } catch (error: unknown) {
        const message = error instanceof Error && error.message
            ? error.message
            : t('serverErrorMessages.genericErrorMessage')
        toast.error(message)
    }
}
</script>
