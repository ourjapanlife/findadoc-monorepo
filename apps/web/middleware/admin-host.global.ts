import { adminHostTarget, adminSiteMode, isAdminHost } from '~/utils/adminSite'

/**
 * A client navigation to the root of the admin hostname. The document request
 * is redirected by the server middleware.
 */
export default defineNuxtRouteMiddleware(to => {
    if (import.meta.server) {
        return
    }

    if (!isAdminHost(window.location.hostname)) {
        return
    }

    const config = useRuntimeConfig()
    const mode = adminSiteMode(config.public.adminSite)
    if (mode === 'off') {
        return abortNavigation(createError({
            statusCode: 404,
            statusMessage: 'Page not found'
        }))
    }

    const target = adminHostTarget(window.location.hostname, to.path, mode)
    if (!target || target === to.path) {
        return
    }

    return navigateTo({ path: target, query: to.query }, { redirectCode: 301 })
})
