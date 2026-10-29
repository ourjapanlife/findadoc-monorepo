import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { BookingClinic } from '@findadoc/graphql'
import { useAuthStore } from '~/stores/authStore'
import { fetchMyBookingClinics } from '~/utils/booking/staffQuery'

/**
 * The clinics the signed-in account belongs to, for the account menu, My Page,
 * and `/clinic-dashboard`. Loads on sign-in and clears on sign-out.
 */
export const useMyBookingClinicsStore = defineStore('myBookingClinicsStore', () => {
    const authStore = useAuthStore()
    /** Null when the last load failed. */
    const clinics = ref<BookingClinic[] | null>(null)
    const isLoading = ref(false)

    const hasClinics = computed(() => (clinics.value?.length ?? 0) > 0)
    const requestedCount = computed(() =>
        (clinics.value ?? []).reduce((total, clinic) => total + clinic.requestedCount, 0))

    async function refresh(): Promise<BookingClinic[] | null> {
        isLoading.value = true
        try {
            clinics.value = await fetchMyBookingClinics()
        } finally {
            isLoading.value = false
        }
        return clinics.value
    }

    function reset(): void {
        clinics.value = null
        isLoading.value = false
    }

    watch(
        () => [authStore.isLoggedIn, authStore.isLoadingAuth] as const,
        ([isLoggedIn, isLoadingAuth]) => {
            if (!isLoggedIn) {
                reset()
                return
            }
            if (!isLoadingAuth && clinics.value === null && !isLoading.value) {
                void refresh()
            }
        },
        { immediate: true }
    )

    return { clinics, isLoading, hasClinics, requestedCount, refresh, reset }
})
