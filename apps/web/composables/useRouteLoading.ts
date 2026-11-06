import { onScopeDispose, shallowRef } from 'vue'
import { useLoadingIndicator, useNuxtApp } from '#imports'
import { createSlowNavigationSignal } from '~/utils/slowNavigation'

/**
 * Route loading state for the bar and the slow-navigation pill (#228).
 * The bar follows Nuxt's page loading hooks; `isSlow` turns on after SLOW_NAVIGATION_MS.
 */
export function useRouteLoading() {
    const indicator = useLoadingIndicator({ throttle: 100 })
    const isSlow = shallowRef(false)

    if (import.meta.client) {
        const nuxtApp = useNuxtApp()
        const signal = createSlowNavigationSignal(slow => {
            isSlow.value = slow
        })
        const unhooks = [
            nuxtApp.hook('page:loading:start', signal.start),
            nuxtApp.hook('page:loading:end', signal.stop),
            nuxtApp.hook('vue:error', signal.stop)
        ]
        onScopeDispose(() => {
            signal.stop()
            for (const unhook of unhooks) {
                unhook()
            }
        })
    }

    return { progress: indicator.progress, isLoading: indicator.isLoading, isSlow }
}
