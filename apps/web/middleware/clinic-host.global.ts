import { clinicLandingGate, useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { clinicHostLandingTarget, clinicLandingHostSlug, isClinicHostPage } from '~/utils/clinicLanding'

/**
 * A clinic hostname opens the clinic at `/`. Other pages on that host come back
 * to `/`. The preview cookie is the same gate as `/clinic/{slug}` on the main site.
 */
export default defineNuxtRouteMiddleware(to => {
    const mode = useClinicLandingMode()
    const { hostname } = useRequestHost()
    if (mode === 'off' || clinicLandingHostSlug(hostname) === undefined) {
        return
    }

    if (isClinicHostPage(to.path)) {
        return clinicLandingGate(to, mode)
    }

    const target = clinicHostLandingTarget(hostname, to.path, mode)
    if (target === undefined || target === to.path) {
        return
    }

    return navigateTo({ path: target, query: to.query }, { redirectCode: 301 })
})
