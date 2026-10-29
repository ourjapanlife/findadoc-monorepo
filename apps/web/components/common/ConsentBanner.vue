<template>
    <section
        v-if="isOpen"
        class="fixed inset-x-0 bottom-0 z-50 border-t border-accent-bg bg-secondary-bg p-4 shadow-lg
        pb-[max(1rem,env(safe-area-inset-bottom))]"
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
                        class="text-primary underline"
                    >{{ t('consent.privacyLink') }}</NuxtLink>
                </p>
            </div>
            <!-- Same style and size for both: declining must be as easy as accepting. -->
            <div class="flex shrink-0 gap-2">
                <button
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
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConsent } from '~/composables/useConsent'
import { localizedPath } from '~/utils/localePath'

const { t, locale } = useI18n()
const { isOpen, openIfUndecided, choose } = useConsent()
const privacyPath = computed(() => `${localizedPath('/privacypolicy', String(locale.value))}#cookies`)

onMounted(openIfUndecided)
</script>
