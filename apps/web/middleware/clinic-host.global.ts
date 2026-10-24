import {
    CLINIC_LANDING_PREVIEW_COOKIE,
    CLINIC_LANDING_PREVIEW_MAX_AGE,
    clinicHostLandingTarget,
    clinicLandingAccess,
    clinicLandingHostSlug,
    clinicLandingMode,
    isClinicHostPage
} from '~/utils/clinicLanding'

/**
 * A clinic hostname opens the clinic at `/`. Other pages on that host come back
 * to `/`. The preview cookie is the same gate as `/clinic/{slug}` on the main site.
 */
export default defineNuxtRouteMiddleware(to => {
    const requestUrl = useRequestURL()
    const host = import.meta.server ? requestUrl.hostname : window.location.hostname
    const config = useRuntimeConfig()
    const mode = clinicLandingMode(config.public.onlineClinic)
    if (!clinicLandingHostSlug(host) || mode === 'off') {
        return
    }

    if (isClinicHostPage(to.path)) {
        const preview = Array.isArray(to.query.preview) ? to.query.preview[0] : to.query.preview
        const cookie = useCookie<string | null>(CLINIC_LANDING_PREVIEW_COOKIE, {
            path: '/',
            sameSite: 'lax',
            maxAge: CLINIC_LANDING_PREVIEW_MAX_AGE
        })
        const access = clinicLandingAccess(mode, preview, cookie.value)
        if (access === 'grant') {
            cookie.value = '1'
            return
        }
        if (access === 'revoke') {
            cookie.value = null
        }
        if (access === 'allow') {
            return
        }
        return abortNavigation(createError({
            statusCode: 404,
            statusMessage: 'Page not found'
        }))
    }

    const target = clinicHostLandingTarget(host, to.path, mode)
    if (!target || target === to.path) {
        return
    }

    return navigateTo({ path: target, query: to.query }, { redirectCode: 301 })
})
