import { clinicHostLandingTarget, clinicLandingMode } from '~/utils/clinicLanding'

/**
 * A client navigation to the root of a clinic hostname. The document request
 * is redirected by the server middleware and, on Netlify, by the edge function.
 */
export default defineNuxtRouteMiddleware(to => {
    if (import.meta.server) {
        return
    }

    const config = useRuntimeConfig()
    const target = clinicHostLandingTarget(
        window.location.hostname,
        to.path,
        clinicLandingMode(config.public.onlineClinic)
    )
    if (!target || target === to.fullPath) {
        return
    }

    return navigateTo({ path: target, query: to.query }, { redirectCode: 301 })
})
