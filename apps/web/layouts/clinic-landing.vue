<template>
    <div class="flex min-h-dvh w-full flex-col bg-primary-bg font-sans text-primary-text">
        <main class="flex-1">
            <slot />
        </main>
        <footer class="shrink-0 border-t border-accent-bg">
            <div class="p-6 landscape:px-12">
                <div
                    class="page-container flex flex-col items-center gap-4
                        landscape:flex-row landscape:justify-between"
                >
                    <a
                        :href="siteOrigin"
                        class="inline-flex items-center gap-3 text-sm text-primary-text-muted
                            transition-colors hover:text-primary"
                        data-testid="clinic-landing-credit"
                    >
                        <SVGSiteLogo
                            class="size-8 fill-primary"
                            aria-hidden="true"
                        />
                        <span>{{ t('footer.poweredBy', { name: t('common.siteName') }) }}</span>
                    </a>
                    <div class="flex items-center gap-4">
                        <a
                            :href="`#${CONSENT_SETTINGS_HASH}`"
                            class="text-sm text-primary-text-muted transition-colors hover:text-primary"
                            data-testid="clinic-landing-cookie-settings"
                            @click.prevent="openSettings"
                        >{{ t('consent.settings') }}</a>
                        <ThemeManager />
                    </div>
                </div>
            </div>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SVGSiteLogo from '~/assets/icons/site-logo.svg'
import { useConsent } from '~/composables/useConsent'
import { CONSENT_SETTINGS_HASH } from '~/utils/consent'
import { SITE_ORIGIN } from '~/utils/site'

const { t } = useI18n()
const { openSettings } = useConsent()
const siteOrigin = SITE_ORIGIN
</script>
