<template>
    <section
        class="card m-4 flex max-w-2xl flex-col gap-4 p-5 shadow-card landscape:p-6"
        data-testid="mod-clinic-accounts"
    >
        <p class="text-sm text-primary-text-muted">
            {{ t('modDashboardTopbar.clinicAccountsHelp') }}
        </p>
        <label class="flex w-full min-w-0 flex-col gap-1 text-sm">
            <span class="font-medium text-primary-text">{{ t('modDashboardTopbar.openClinicDashboard') }}</span>
            <select
                v-model="pickedClinicId"
                class="field max-w-md"
                data-testid="mod-clinic-dashboard-picker"
                :disabled="clinics === undefined || clinics === null || clinics.length === 0"
                @change="openClinic"
            >
                <option
                    value=""
                    disabled
                >
                    {{ placeholderLabel }}
                </option>
                <option
                    v-for="clinic in clinics ?? []"
                    :key="clinic.facilityId"
                    :value="clinic.facilityId"
                >
                    {{ clinic.clinicName }}
                </option>
            </select>
        </label>
        <ChikoLoader
            v-if="clinics === undefined"
            size="sm"
            hide-label
        />
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { BookingClinic } from '@findadoc/graphql'
import { navigateTo, useI18n } from '#imports'
import ChikoLoader from '~/components/common/ChikoLoader.vue'
import { fetchAllBookingClinics } from '~/utils/booking/staffQuery'
import { localeCodeFromPath, localizedPath } from '~/utils/localePath'

/**
 * Admins pick a clinic and open its dashboard to invite the owner and staff, or to turn
 * interpretation on. An admin who is not a member of that clinic sees no bookings there (#192).
 */
const { t } = useI18n()
const route = useRoute()
// undefined while the request is in flight, null when it failed.
const clinics = ref<BookingClinic[] | null | undefined>(undefined)

const placeholderLabel = computed(() => {
    if (clinics.value === undefined) {
        return t('common.loading')
    }
    if (clinics.value === null) {
        return t('modDashboardTopbar.clinicsLoadError')
    }
    return clinics.value.length === 0
        ? t('modDashboardTopbar.noBookingClinics')
        : t('modDashboardTopbar.chooseClinic')
})
const pickedClinicId = ref('')

async function openClinic(): Promise<void> {
    if (pickedClinicId.value === '') {
        return
    }
    await navigateTo(localizedPath(`/clinic-dashboard/${pickedClinicId.value}`, localeCodeFromPath(route.path)))
}

onMounted(async () => {
    clinics.value = await fetchAllBookingClinics()
})
</script>
