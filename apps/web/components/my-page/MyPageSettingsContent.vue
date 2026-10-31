<template>
    <div class="overflow-y-auto p-4 md:h-full md:p-6">
        <div class="mx-auto max-w-2xl">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-primary-text md:text-3xl">
                    {{ t('settingsPage.heading') }}
                </h1>
                <span class="text-primary-text-muted">{{ t('settingsPage.subheading') }}</span>
            </div>

            <div class="mb-6 rounded-lg border border-accent-bg bg-secondary-bg p-6">
                <div class="mb-6">
                    <h2 class="mb-3 text-xl font-semibold text-primary-text">
                        {{ t('settingsPage.healthcareProfessionalName') }}
                    </h2>
                    <div class="flex items-center gap-6">
                        <div
                            class="flex size-20 items-center justify-center overflow-hidden
                            rounded-full border-2 border-accent-bg"
                        >
                            <img
                                :src="mascotIllustration"
                                alt=""
                                width="1024"
                                height="1024"
                                loading="lazy"
                                decoding="async"
                                class="size-16 stroke-primary"
                            >
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <h2 class="mb-3 text-xl font-semibold text-primary-text">
                        {{ t('settingsPage.displayName') }}
                    </h2>
                    <input
                        v-model="displayName"
                        type="text"
                        class="w-full rounded-lg border border-accent-bg bg-secondary-bg px-4
                        py-3 text-primary-text placeholder-primary-text-muted"
                    >
                </div>

                <div class="flex justify-end">
                    <button class="rounded-lg bg-primary px-6 py-3 font-medium text-primary-text-inverted">
                        {{ t('settingsPage.updateButton') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '#imports'
// Served as a cached file rather than inlined into the chunk; bound so the compiler leaves the URL alone.
const mascotIllustration = '/illustrations/characters-chiko-therapy-dog-primary.svg'

const { t } = useI18n()
const displayName = ref('')
</script>
