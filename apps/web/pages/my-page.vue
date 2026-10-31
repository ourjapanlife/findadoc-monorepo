<template>
    <div class="flex flex-col md:h-full md:min-h-0">
        <Suspense>
            <div
                data-testid="moderation-content"
                class="flex w-full flex-1 flex-col bg-primary-bg font-sans text-primary-text
                md:h-full md:min-h-0 md:overflow-hidden"
            >
                <div
                    v-if="authStore.isLoadingAuth"
                    class="my-16 flex size-full justify-center justify-items-center
                self-center text-center text-2xl font-bold text-primary-text"
                >
                    {{ t('login.checkingauth') }}
                </div>
                <div
                    v-if="!doesTheUserHaveAccess"
                    data-testid="unauthorized-message"
                >
                    <div
                        class="my-16 flex size-full flex-col justify-center justify-items-center self-center
                    text-center text-2xl font-bold text-primary-text"
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
                    class="flex flex-1 flex-col gap-3 p-3 md:h-full md:min-h-0 md:flex-row md:gap-4 md:overflow-hidden md:p-4"
                >
                    <ModLeftNavbar />
                    <div class="flex w-full flex-1 flex-col items-stretch gap-3 md:min-h-0 md:gap-4 md:overflow-hidden">
                        <div
                            v-if="!isSettingsView && !isBookingDetailView"
                            class="shrink-0 rounded-xl border border-accent-bg bg-secondary-bg
                            p-3 shadow-sm md:px-5 md:py-4"
                        >
                            <ModTopbar />
                        </div>
                        <div
                            class="flex-1 rounded-xl border border-accent-bg bg-secondary-bg
                            shadow-sm md:min-h-0 md:overflow-hidden"
                        >
                            <ModMainContent />
                        </div>
                    </div>
                </div>
            </div>
            <template #fallback>
                <div
                    class="my-16 flex size-full justify-center justify-items-center
                self-center text-center text-2xl font-bold text-primary-text"
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
