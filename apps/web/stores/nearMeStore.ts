import { defineStore } from 'pinia'
import { computed, ref, type Ref } from 'vue'
import type { GeoPoint } from '@findadoc/utils'

/**
 * Where "Near me" stands.
 * - `unsupported`: no geolocation, or not a secure page. The button is hidden.
 * - `idle`: not asked yet on this visit.
 * - `locating`: waiting for the browser, which may be showing its permission prompt.
 * - `located`: a position is held in memory.
 * - `denied`: the visitor or the browser refused location for this site.
 * - `unavailable`: allowed, but no position came back (no signal, timeout).
 */
export const NEAR_ME_STATUS = {
    UNSUPPORTED: 'unsupported',
    IDLE: 'idle',
    LOCATING: 'locating',
    LOCATED: 'located',
    DENIED: 'denied',
    UNAVAILABLE: 'unavailable'
} as const
export type NearMeStatus = typeof NEAR_ME_STATUS[keyof typeof NEAR_ME_STATUS]

/*
 * A coarse fix is enough to sort clinics and comes back faster on less battery. A position up
 * to ten minutes old is reused rather than asking the device again.
 */
const POSITION_OPTIONS: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 10 * 60 * 1000,
    timeout: 10 * 1000
}

function geolocationAvailable(): boolean {
    return import.meta.client && window.isSecureContext && 'geolocation' in navigator
}

/**
 * The visitor's position for sorting `/search` by distance.
 *
 * It lives in memory for this visit and nowhere else. It is not sent to the API, written to
 * storage, a cookie, or the URL, and not attached to analytics or Sentry. A reload forgets it.
 * The browser is asked only when the visitor taps "Near me", or silently when the browser
 * already says this site may know the location.
 */
export const useNearMeStore = defineStore('nearMeStore', () => {
    const status: Ref<NearMeStatus> = ref(NEAR_ME_STATUS.IDLE)
    const position: Ref<GeoPoint | undefined> = ref()
    /** True when the browser reports the permission as already granted, so asking shows no prompt. */
    const permissionGranted = ref(false)
    let watchingPermission = false

    const isSupported = computed(() => status.value !== NEAR_ME_STATUS.UNSUPPORTED)

    function applyPermissionState(state: PermissionState) {
        permissionGranted.value = state === 'granted'
        if (state === 'denied') {
            position.value = undefined
            status.value = NEAR_ME_STATUS.DENIED
        } else if (status.value === NEAR_ME_STATUS.DENIED) {
            // Turned back on in the browser's site settings.
            status.value = NEAR_ME_STATUS.IDLE
        }
    }

    /**
     * Reads the permission without prompting, where the browser can say (Safari before 16 cannot).
     * Call once on mount. It also follows later changes made in the browser's site settings.
     */
    async function checkPermission(): Promise<void> {
        if (!geolocationAvailable()) {
            status.value = NEAR_ME_STATUS.UNSUPPORTED
            return
        }
        if (watchingPermission || !navigator.permissions?.query) {
            return
        }
        // Set before the await, so a second call while the first is pending adds no second listener.
        watchingPermission = true
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' })
            applyPermissionState(permission.state)
            permission.addEventListener('change', () => applyPermissionState(permission.state))
        } catch {
            // Some browsers do not list geolocation here. Asking still works.
        }
    }

    /** Asks the browser for a position. Resolves with it, or undefined when there is none. */
    function locate(): Promise<GeoPoint | undefined> {
        if (!geolocationAvailable()) {
            status.value = NEAR_ME_STATUS.UNSUPPORTED
            return Promise.resolve(undefined)
        }

        status.value = NEAR_ME_STATUS.LOCATING
        return new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    position.value = { latitude: coords.latitude, longitude: coords.longitude }
                    status.value = NEAR_ME_STATUS.LOCATED
                    resolve(position.value)
                },
                error => {
                    position.value = undefined
                    status.value = error.code === error.PERMISSION_DENIED
                        ? NEAR_ME_STATUS.DENIED
                        : NEAR_ME_STATUS.UNAVAILABLE
                    resolve(undefined)
                },
                POSITION_OPTIONS
            )
        })
    }

    return {
        status,
        position,
        permissionGranted,
        isSupported,
        checkPermission,
        locate
    }
})
