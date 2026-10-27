import type { RouteLocationNormalized } from 'vue-router'
import { abortNavigation, createError, useCookie, useRequestURL, useRuntimeConfig } from '#imports'
import {
    CLINIC_LANDING_PREVIEW_COOKIE,
    CLINIC_LANDING_PREVIEW_MAX_AGE,
    clinicLandingAccess,
    clinicLandingMode,
    clinicLandingPreviewFlag,
    markClinicHostReady,
    type ClinicLandingMode
} from '~/utils/clinicLanding'

/** The build's landing mode. Dev, the browser, and the server middleware all read this one value. */
export function useClinicLandingMode(): ClinicLandingMode {
    return clinicLandingMode(useRuntimeConfig().public.onlineClinic)
}

/**
 * `host:port` the request arrived on. `useRequestURL` follows the generated
 * site URL during hydration of `index.html`. The clinic host is the address
 * bar, so the browser reads `window.location` itself.
 */
export function useRequestHost(): { host: string, hostname: string } {
    if (import.meta.client) {
        return { host: window.location.host, hostname: window.location.hostname }
    }
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
    // Amplify serves the homepage payload at `/`. That route has no `preview`
    // query, so the address bar is the source of truth in the browser.
    const preview = clinicLandingPreviewFlag(
        to.query.preview,
        import.meta.client ? window.location.search : undefined
    )
    const cookie = useCookie<string | null>(CLINIC_LANDING_PREVIEW_COOKIE, {
        path: '/',
        sameSite: 'lax',
        maxAge: CLINIC_LANDING_PREVIEW_MAX_AGE,
        // The default codec writes the JSON `"1"` and reads a bare `1` back as a number.
        // Store the bare value so `online_clinic_preview=1` means the same everywhere.
        encode: value => value ?? '',
        decode: value => value ?? null
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

    // The hide-until-ready style stays on until Vue marks the host. A 404
    // during hydration never reaches `app.vue` `onMounted`, so unhide here.
    if (import.meta.client) {
        markClinicHostReady()
    }

    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page not found' }))
}
