<template>
    <section
        data-testid="clinic-correction-prompt"
        :data-hydrated="hydrated || undefined"
        :aria-label="variant === 'confirm' ? t('clinicCorrection.confirmHeading') : undefined"
    >
        <div
            v-if="variant === 'confirm'"
            class="card flex flex-col items-start gap-3 p-5"
        >
            <h2 class="text-lg font-semibold text-primary-text">
                {{ t('clinicCorrection.confirmHeading') }}
            </h2>
            <p class="m-0 text-primary-text-muted">
                {{ t('clinicCorrection.confirmBody') }}
            </p>
            <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-testid="clinic-correction-open"
                @click="open"
            >
                {{ t('clinicCorrection.confirmButton') }}
            </button>
        </div>
        <p
            v-else
            class="m-0 text-sm text-primary-text-muted"
        >
            <button
                type="button"
                class="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                data-testid="clinic-correction-open"
                @click="open"
            >
                {{ t('clinicCorrection.promptLink') }}
            </button>
        </p>

        <ClinicCorrectionDialog
            v-if="isOpen"
            :facility="facility"
            :variant="variant"
            @close="close"
        />
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUmami } from '~/composables/useUmamiTracking'
import { correctionPromptVariant } from '~/utils/facilityCorrection'
import type { FacilitySearchResult } from '~/utils/searchDirectory'

/**
 * "See an error? Let us know" under the clinic details (#22). A listing a moderator has not
 * confirmed gets the louder "Help us confirm this listing" card instead. Both open the same form.
 * It is a footnote: it sits below the Book, website, and map actions and does not compete with them.
 */
const props = defineProps<{
    facility: FacilitySearchResult
}>()

const { t } = useI18n()
const { track } = useUmami()

const isOpen = ref(false)
const variant = computed(() => correctionPromptVariant(props.facility.verificationStatus))

// The page is prerendered: the button does nothing until Vue hydrates it. Playwright waits for this.
const hydrated = ref(false)
onMounted(() => {
    hydrated.value = true
})

function open() {
    isOpen.value = true
    track('Correction opened', { variant: variant.value })
}

function close() {
    isOpen.value = false
}
</script>
