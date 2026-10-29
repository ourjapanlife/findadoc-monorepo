<template>
    <footer
        role="contentinfo"
        data-testid="footer"
        class="w-full border-t border-accent-bg bg-secondary-bg text-primary-text"
    >
        <div class="px-6 py-12 landscape:px-12">
            <div
                class="page-container grid gap-10 landscape:grid-cols-[1.6fr_1fr_1fr_1fr]"
            >
                <!-- Brand -->
                <div class="flex flex-col gap-3">
                    <NuxtLink
                        to="/"
                        class="flex w-fit items-center gap-2 font-semibold text-primary"
                    >
                        <SVGSiteLogo
                            class="h-8 w-8 fill-primary"
                            aria-hidden="true"
                        />
                        <span>{{ t('common.siteName') }}</span>
                    </NuxtLink>
                    <p class="max-w-xs text-primary-text-muted">
                        {{ t('about.heroSubheading') }}
                    </p>
                </div>

                <!-- Explore -->
                <nav :aria-label="t('footer.exploreHeading')">
                    <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-text-muted">
                        {{ t('footer.exploreHeading') }}
                    </h3>
                    <ul class="m-0 flex list-none flex-col gap-2 p-0">
                        <li>
                            <NuxtLink
                                to="/search"
                                :class="footerLink"
                            >{{ t('topNav.search') }}</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                to="/about"
                                :class="footerLink"
                            >{{ t('topNav.about') }}</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                to="/submit"
                                :class="footerLink"
                            >{{ t('topNav.submit') }}</NuxtLink>
                        </li>
                    </ul>
                </nav>

                <!-- Community -->
                <nav :aria-label="t('footer.communityHeading')">
                    <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-text-muted">
                        {{ t('footer.communityHeading') }}
                    </h3>
                    <ul class="m-0 flex list-none flex-col gap-2 p-0">
                        <li>
                            <NuxtLink
                                to="https://docs.findadoc.jp"
                                target="_blank"
                                rel="noopener"
                                :class="footerLink"
                                data-testid="contribute-link"
                            >{{ t('footer.contribute') }}</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                to="/contact"
                                :class="footerLink"
                                data-testid="contact-link"
                            >{{ t('footer.contact') }}</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                :to="GITHUB_ORGANIZATION_URL"
                                target="_blank"
                                rel="noopener"
                                :class="footerLink"
                            >GitHub</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                :to="LINKEDIN_ORGANIZATION_URL"
                                target="_blank"
                                rel="noopener"
                                :class="footerLink"
                            >LinkedIn</NuxtLink>
                        </li>
                    </ul>
                </nav>

                <!-- Legal -->
                <nav :aria-label="t('footer.legalHeading')">
                    <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-text-muted">
                        {{ t('footer.legalHeading') }}
                    </h3>
                    <ul class="m-0 flex list-none flex-col gap-2 p-0">
                        <li>
                            <NuxtLink
                                to="/privacypolicy"
                                :class="footerLink"
                                data-testid="privacy-link"
                            >{{ t('footer.privacy') }}</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                to="/terms"
                                :class="footerLink"
                                data-testid="terms-link"
                            >{{ t('footer.terms') }}</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink
                                to="/npo"
                                :class="footerLink"
                                data-testid="npo-link"
                            >{{ t('footer.npo') }}</NuxtLink>
                        </li>
                        <li>
                            <button
                                type="button"
                                :class="footerLink"
                                data-testid="cookie-settings-link"
                                @click="openSettings"
                            >
                                {{ t('consent.settings') }}
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>

        <div class="border-t border-accent-bg">
            <div class="px-6 py-4 landscape:px-12">
                <div
                    class="page-container flex flex-col gap-4 text-sm text-primary-text-muted
                           landscape:flex-row landscape:items-center landscape:justify-between"
                >
                    <p class="m-0">
                        © {{ currentYear }} {{ t('footer.copyright') }}
                    </p>
                    <ThemeManager />
                </div>
            </div>
        </div>
    </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SVGSiteLogo from '~/assets/icons/site-logo.svg'
import { GITHUB_ORGANIZATION_URL, LINKEDIN_ORGANIZATION_URL } from '~/utils/site'
import { useConsent } from '~/composables/useConsent'

const { t } = useI18n()

const { openSettings } = useConsent()

const currentYear = new Date().getUTCFullYear()

// One place for the link treatment rather than a scoped stylesheet, which Tailwind v4 cannot @apply into.
const footerLink = 'inline-flex min-h-11 items-center text-primary-text transition-colors hover:text-primary'
</script>

