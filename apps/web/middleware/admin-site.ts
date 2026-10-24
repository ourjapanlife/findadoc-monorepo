import {
    ADMIN_SITE_PREVIEW_COOKIE,
    ADMIN_SITE_PREVIEW_MAX_AGE,
    adminSiteAccess,
    adminSiteMode
} from '~/utils/adminSite'

/**
 * Dev and the SPA shell. The Netlify edge function is what returns a real 404
 * before the static file is served. Both call `adminSiteAccess`.
 */
export default defineNuxtRouteMiddleware(to => {
    const config = useRuntimeConfig()
    const mode = adminSiteMode(config.public.adminSite)
    const preview = Array.isArray(to.query.preview) ? to.query.preview[0] : to.query.preview
    const cookie = useCookie<string | null>(ADMIN_SITE_PREVIEW_COOKIE, {
        path: '/',
        sameSite: 'lax',
        maxAge: ADMIN_SITE_PREVIEW_MAX_AGE
    })
    const access = adminSiteAccess(mode, preview, cookie.value)

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
