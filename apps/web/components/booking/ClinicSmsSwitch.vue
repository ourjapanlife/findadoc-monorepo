<template>
    <div class="flex flex-col gap-3">
        <label
            class="flex items-start gap-3"
            :class="props.settings.canChangeSms ? 'cursor-pointer' : 'cursor-not-allowed'"
        >
            <input
                type="checkbox"
                class="mt-0.5 size-5 shrink-0 accent-primary"
                :checked="props.settings.offersSms"
                :disabled="!props.settings.canChangeSms || saving"
                :aria-describedby="helpId"
                data-testid="clinic-settings-sms-toggle"
                @change="toggle"
            >
            <span class="font-semibold text-primary-text">{{ t('clinicDashboard.settings.sms') }}</span>
        </label>
        <p
            :id="helpId"
            class="ml-8 text-sm text-primary-text-muted"
        >
            {{ t('clinicDashboard.settings.smsHelp') }}
            <template v-if="!props.settings.canChangeSms">
                {{ t('clinicDashboard.settings.smsLocked') }}
            </template>
        </p>
    </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingSettings } from '@findadoc/graphql'
import { useAppToast } from '~/composables/useAppToast'
import { setBookingSms } from '~/utils/booking/staffQuery'

/**
 * SMS on or off for one clinic's patients (#206). It is meant to be a paid add-on, so
 * only an admin may change it and an owner sees it read-only. It saves on its own.
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
const helpId = `clinic-sms-help-${useId()}`

async function toggle(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) {
        return
    }
    const checkbox = event.target
    saving.value = true
    const saved = await setBookingSms({
        facilityId: props.facilityId,
        offersSms: checkbox.checked
    })
    saving.value = false
    if (saved === null) {
        checkbox.checked = props.settings.offersSms
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    emit('saved', saved)
    toast.success(t('clinicDashboard.saved'))
}
</script>
