<template>
    <section
        data-testid="privacy-page"
        class="page-section"
    >
        <div class="page-container-narrow flex flex-col gap-8">
            <header class="flex flex-col gap-3">
                <h1
                    data-testid="privacy-heading"
                    class="page-title-sm"
                >
                    {{ t('privacyPage.heading') }}
                </h1>
                <p
                    data-testid="privacy-subheading"
                    class="text-lg text-primary-text-muted"
                >
                    {{ t('privacyPage.subheading') }}
                </p>
                <p class="text-sm text-primary-text-muted">
                    {{ t('privacyPage.date') }}
                </p>
            </header>

            <div class="prose-legal">
                <template
                    v-for="section in PRIVACY_SECTIONS"
                    :key="section.id"
                >
                    <h2 :id="section.anchor">
                        {{ t(`privacyPage.sections.${section.id}.heading`) }}
                    </h2>
                    <p
                        v-for="n in section.paragraphs"
                        :key="n"
                    >
                        {{ t(`privacyPage.sections.${section.id}.p${n}`) }}
                    </p>
                </template>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PRIVACY_SECTIONS } from '~/utils/privacyPolicy'

const { t } = useI18n()
</script>
