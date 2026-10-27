import type { RouteLocationNormalized } from 'vue-router'
import { abortNavigation, createError, useCookie, useRequestURL, useRuntimeConfig } from '#imports'
import {
    CLINIC_LANDING_PREVIEW_COOKIE,
    CLINIC_LANDING_PREVIEW_MAX_AGE,
    clinicLandingAccess,
    clinicLandingMode,
    type ClinicLandingMode
} from '~/utils/clinicLanding'

/** The build's landing mode. Dev, the browser, and the server middleware all read this one value. */
export function useClinicLandingMode(): ClinicLandingMode {
    return clinicLandingMode(useRuntimeConfig().public.onlineClinic)
}

/** `host:port` the request arrived on. `useRequestURL` reads `window.location` in the browser. */
export function useRequestHost(): { host: string, hostname: string } {
    const url = useRequestURL()
    return { host: url.host, hostname: url.hostname }
}

/**
 * The preview gate for a landing navigation. `?preview=1` stores the cookie and
 * `?preview=0` clears it. Returns the 404 to hand back from route middleware, or
 * `undefined` when the navigation may continue.
 */
export function clinicLandingGate(
    to: RouteLocationNormalized,
    mode: ClinicLandingMode
): ReturnType<typeof abortNavigation> | undefined {
    const preview = Array.isArray(to.query.preview) ? to.query.preview[0] : to.query.preview
    const cookie = useCookie<string | null>(CLINIC_LANDING_PREVIEW_COOKIE, {
        path: '/',
        sameSite: 'lax',
        maxAge: CLINIC_LANDING_PREVIEW_MAX_AGE,
        // The default codec writes the JSON `"1"` and reads a bare `1` back as a number.
        // Store the bare value so `online_clinic_preview=1` means the same everywhere.
        encode: value => String(value),
        decode: value => value
    })

    switch (clinicLandingAccess(mode, preview, cookie.value)) {
        case 'grant':
            cookie.value = '1'
            return undefined
        case 'allow':
            return undefined
        case 'revoke':
            cookie.value = null
            break
        case 'deny':
            break
    }

    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page not found' }))
}
