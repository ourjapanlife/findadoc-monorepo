import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useAuthStore } from '~/stores/authStore'

/**
 * Booking intake and staff booking GraphQL require a real Auth0 session for now.
 * Returns ready=true only after Auth0 finishes and the user is logged in.
 * Unauthenticated visitors are sent through loginWithRedirect.
 */
export function useBookingAuthGate(): {
    ready: Ref<boolean>
    isChecking: Ref<boolean>
} {
    const authStore = useAuthStore()
    const ready = ref(false)
    const isChecking = computed(() => authStore.isLoadingAuth || (!authStore.isLoggedIn && !ready.value))

    async function ensureAuthenticated(): Promise<void> {
        await authStore.waitForAuth0ToLoad()
        if (authStore.isLoggedIn) {
            ready.value = true
            return
        }
        ready.value = false
        await authStore.login()
    }

    onMounted(() => {
        void ensureAuthenticated()
    })

    watch(
        () => [authStore.isLoggedIn, authStore.isLoadingAuth] as const,
        ([loggedIn, loading]) => {
            if (loading) {
                return
            }
            if (loggedIn) {
                ready.value = true
                return
            }
            ready.value = false
            void authStore.login()
        }
    )

    return { ready, isChecking }
}
