<template>
    <div class="md:h-full md:min-h-0 flex flex-col">
        <Suspense>
            <div
                data-testid="moderation-content"
                class="w-full flex flex-col flex-1 md:h-full md:min-h-0 md:overflow-hidden
                font-sans text-primary-text bg-primary-bg"
            >
                <div
                    v-if="authStore.isLoadingAuth"
                    class="w-full h-full mt-16 mb-16 text-primary-text text-2xl font-bold
                flex self-center justify-items-center justify-center text-center"
                >
                    {{ t('login.checkingauth') }}
                </div>
                <div
                    v-if="!doesTheUserHaveAccess"
                    data-testid="unauthorized-message"
                >
                    <div
                        class="flex flex-col w-full h-full mt-16 mb-16 text-primary-text text-2xl font-bold
                    self-center justify-items-center justify-center text-center"
                    >
                        <span>{{ t('login.unauthorizedline1') }}</span>
                        <span>{{ t('login.unauthorizedline2') }}</span>
                        <NuxtLink
                            :to="CONTACT_MAILTO"
                            class="inline text-primary underline"
                        >
                            {{ t('login.unauthorizedline3') }}
                        </NuxtLink>
                    </div>
                </div>
                <div
                    v-if="authStore.isLoggedIn"
                    data-testid="moderation-page"
                    class="flex flex-col md:flex-row flex-1 md:min-h-0 md:h-full md:overflow-hidden p-3 md:p-4 gap-3 md:gap-4"
                >
                    <ModLeftNavbar />
                    <div class="w-full flex flex-col items-stretch gap-3 md:gap-4 md:min-h-0 flex-1 md:overflow-hidden">
                        <div
                            v-if="!isSettingsView && !isBookingDetailView"
                            class="shrink-0 bg-secondary-bg border border-accent-bg rounded-xl
                            shadow-sm px-3 md:px-5 py-3 md:py-4"
                        >
                            <ModTopbar />
                        </div>
                        <div
                            class="bg-secondary-bg border border-accent-bg rounded-xl shadow-sm
                            flex-1 md:min-h-0 md:overflow-hidden"
                        >
                            <ModMainContent />
                        </div>
                    </div>
                </div>
            </div>
            <template #fallback>
                <div
                    class="w-full h-full mt-16 mb-16 text-primary-text text-2xl font-bold
                flex self-center justify-items-center justify-center text-center"
                >
                    {{ t('login.checkingauth') }}
                </div>
            </template>
        </Suspense>
        <!-- Nested /my-page/* child routes mount here; visible UI is driven by ModMainContent. -->
        <NuxtPage
            class="hidden"
            aria-hidden="true"
            tabindex="-1"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, type Ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/authStore'
import { definePageMeta, useI18n } from '#imports'
import { unlocalizedPath } from '~/utils/localePath'
import { hidesModerationListTopbar } from '~/utils/moderationView'
import { CONTACT_MAILTO } from '~/utils/site'

definePageMeta({
    layout: 'my-page',
    key: 'my-page',
    ssr: false
})

const { t } = useI18n()
const authStore = useAuthStore()
const route = useRoute()
const doesTheUserHaveAccess: Ref<boolean> = ref(true)
const isSettingsView = computed(() => {
    if (unlocalizedPath(route.path) !== '/my-page') {
        return false
    }
    return hidesModerationListTopbar(route.query.view)
})
const isBookingDetailView = computed(() =>
    /^\/(?:my-page|moderation)\/booking\//.test(unlocalizedPath(route.path)))

const runModerationAuthRedirect = () => {
    void authStore.redirectIfUnauthenticatedUser('/my-page', doesTheUserHaveAccess)
}

watch(
    () => [authStore.isLoggedIn, authStore.isLoadingAuth] as const,
    runModerationAuthRedirect
)
watch(() => route.path, runModerationAuthRedirect)
onMounted(runModerationAuthRedirect)
</script>
