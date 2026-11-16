<template>
    <div class="flex flex-col gap-3">
        <label
            class="flex items-start gap-3"
            :class="props.settings.canChangeInterpretation ? 'cursor-pointer' : 'cursor-not-allowed'"
        >
            <input
                type="checkbox"
                class="mt-0.5 size-5 shrink-0 accent-primary"
                :checked="props.settings.offersInterpretation"
                :disabled="!props.settings.canChangeInterpretation || saving"
                :aria-describedby="helpId"
                data-testid="clinic-settings-interpretation-toggle"
                @change="toggle"
            >
            <span class="font-semibold text-primary-text">{{ t('clinicDashboard.settings.interpretation') }}</span>
        </label>
        <p
            :id="helpId"
            class="ml-8 text-sm text-primary-text-muted"
        >
            {{ t('clinicDashboard.settings.interpretationHelp') }}
            <template v-if="!props.settings.canChangeInterpretation">
                {{ t('clinicDashboard.settings.interpretationLocked') }}
            </template>
        </p>
    </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingSettings } from '@findadoc/graphql'
import { useAppToast } from '~/composables/useAppToast'
import { setBookingInterpretation } from '~/utils/booking/staffQuery'

/**
 * Interpretation on or off for one clinic (#205). Only an admin may change it, so an
 * owner sees it read-only. It saves on its own and emits the saved settings.
 */
const props = defineProps<{
    facilityId: string
    settings: BookingSettings
}>()

const emit = defineEmits<{
    saved: [settings: BookingSettings]
}>()

const { t } = useI18n()
const toast = useAppToast()
const saving = ref(false)
const helpId = `clinic-interpretation-help-${useId()}`

async function toggle(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) {
        return
    }
    const checkbox = event.target
    saving.value = true
    const saved = await setBookingInterpretation({
        facilityId: props.facilityId,
        offersInterpretation: checkbox.checked
    })
    saving.value = false
    if (saved === null) {
        checkbox.checked = props.settings.offersInterpretation
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    emit('saved', saved)
    toast.success(t('clinicDashboard.saved'))
}
</script>
