import {
    CLINIC_LANDING_PREVIEW_COOKIE,
    CLINIC_LANDING_PREVIEW_MAX_AGE,
    clinicLandingAccess,
    clinicLandingMode
} from '~/utils/clinicLanding'

/**
 * Dev and the SPA shell. The Netlify edge function is what returns a real 404
 * before the static file is served. Both call `clinicLandingAccess`.
 */
export default defineNuxtRouteMiddleware(to => {
    const config = useRuntimeConfig()
    const mode = clinicLandingMode(config.public.onlineClinic)
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
})
