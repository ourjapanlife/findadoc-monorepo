<template>
    <div class="flex min-h-dvh w-full flex-col bg-primary-bg font-sans text-primary-text">
        <main class="flex-1">
            <slot />
        </main>
        <footer class="shrink-0 border-t border-accent-bg">
            <div class="px-6 py-6">
                <div class="page-container flex items-center justify-center">
                    <a
                        :href="siteOrigin"
                        class="inline-flex items-center gap-3 text-sm text-primary-text-muted
                            transition-colors hover:text-primary"
                        data-testid="clinic-landing-credit"
                    >
                        <SVGSiteLogo
                            class="h-8 w-8 fill-primary"
                            aria-hidden="true"
                        />
                        <span>{{ t('footer.poweredBy', { name: t('common.siteName') }) }}</span>
                    </a>
                </div>
            </div>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SVGSiteLogo from '~/assets/icons/site-logo.svg'
import { SITE_ORIGIN } from '~/utils/site'

const { t } = useI18n()
const siteOrigin = SITE_ORIGIN
</script>
