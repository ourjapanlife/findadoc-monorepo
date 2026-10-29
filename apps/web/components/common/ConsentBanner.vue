<template>
    <section
        v-if="isOpen"
        class="fixed inset-x-0 bottom-0 z-50 max-h-dvh overflow-y-auto border-t border-accent-bg bg-secondary-bg
        p-4 shadow-lg pb-[max(1rem,env(safe-area-inset-bottom))]"
        :aria-label="t('consent.title')"
        data-testid="consent-banner"
    >
        <div class="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex flex-col gap-1">
                <h2 class="text-base font-semibold text-primary-text">
                    {{ t('consent.title') }}
                </h2>
                <p class="text-sm text-primary-text-muted">
                    {{ t('consent.body') }}
                    <NuxtLink
                        :to="privacyPath"
                        :external="onClinicHost"
                        class="text-primary underline"
                    >{{ t('consent.privacyLink') }}</NuxtLink>
                </p>
            </div>
            <!-- Same style and size for both: declining must be as easy as accepting. -->
            <div class="flex shrink-0 gap-2">
                <button
                    ref="firstAction"
                    type="button"
                    class="btn btn-secondary"
                    data-testid="consent-decline"
                    @click="choose('denied')"
                >
                    {{ t('consent.decline') }}
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    data-testid="consent-accept"
                    @click="choose('granted')"
                >
                    {{ t('consent.accept') }}
                </button>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConsent } from '~/composables/useConsent'
import { useRequestHost } from '~/composables/useClinicLanding'
import { clinicLandingHostSlug } from '~/utils/clinicLanding'
import { localizedPath } from '~/utils/localePath'
import { SITE_ORIGIN } from '~/utils/site'

const { t, locale } = useI18n()
const { isOpen, openedOnRequest, openIfUndecided, openFromHash, choose } = useConsent()
const { hostname } = useRequestHost()
// A clinic subdomain sends /privacypolicy back to the clinic page, so link to the main site there.
const onClinicHost = clinicLandingHostSlug(hostname) !== undefined
const privacyPath = computed(() => {
    const path = `${localizedPath('/privacypolicy', String(locale.value))}#cookies`
    return onClinicHost ? `${SITE_ORIGIN}${path}` : path
})
const firstAction = ref<HTMLButtonElement | null>(null)

// Opened from Cookie settings: move focus in, so the change is obvious and keyboard users land on it.
watch(isOpen, async open => {
    if (open && openedOnRequest.value) {
        await nextTick()
        firstAction.value?.focus()
    }
})

onMounted(() => {
    openIfUndecided()
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', openFromHash))
</script>
