<template>
    <div class="flex min-h-dvh w-full flex-col bg-primary-bg font-sans text-primary-text">
        <TopNav
            v-if="chrome === null"
            class="shrink-0"
        />
        <!--
            One slot in one place for both states: the page loads its clinic under the
            Find a Doc header, then the clinic header replaces it without remounting the page.
        -->
        <div
            class="flex flex-1 flex-col"
            :class="{ 'clinic-theme': themeStyle !== undefined }"
            :style="themeStyle"
            :data-testid="chrome === null ? undefined : 'clinic-branded'"
        >
            <ClinicBrandedHeader
                v-if="chrome !== null"
                :chrome="chrome"
            />
            <main class="flex-1">
                <slot />
            </main>
        </div>
        <Footer
            v-if="chrome === null"
            class="shrink-0"
        />
        <ClinicCreditFooter
            v-else
            test-id-prefix="clinic-branded"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ClinicBrandedHeader from '~/components/clinic/ClinicBrandedHeader.vue'
import ClinicCreditFooter from '~/components/clinic/ClinicCreditFooter.vue'
import { useClinicBrandedChrome } from '~/composables/useClinicBranding'
import { clinicThemeVars } from '~/utils/clinicTheme'

/**
 * The clinic's own header and colour on `/book/{clinicId}`, `/book/manage`, and
 * `/clinic-dashboard/{facilityId}` (online consult v2 §4). The page sets the branding once
 * its clinic loads. Until then, and for a clinic with no clinic page, this is the default
 * Find a Doc layout. The credit footer sits outside the clinic colour, like the landing's.
 */
const state = useClinicBrandedChrome()
const chrome = computed(() => state.value?.chrome ?? null)
const themeStyle = computed(() => clinicThemeVars(chrome.value?.branding.primary))
</script>
