import { defineEventHandler, getRequestURL, sendRedirect, setResponseStatus } from 'h3'
import { useRuntimeConfig } from '#imports'
import { adminHostTarget, adminSiteMode, isAdminHost } from '~/utils/adminSite'

/**
 * Dev, and any server render. Netlify static hosting uses the edge function
 * for the same redirect. Off mode answers the admin host with 404.
 * The mode comes from runtime config, so `pnpm dev` and the browser agree.
 */
export default defineEventHandler(event => {
    const url = getRequestURL(event)
    if (!isAdminHost(url.hostname)) {
        return
    }

    const config = useRuntimeConfig(event)
    const mode = adminSiteMode(config.public.adminSite)
    if (mode === 'off') {
        setResponseStatus(event, 404)
        return 'Not found'
    }

    const target = adminHostTarget(url.hostname, url.pathname, mode)
    if (!target) {
        return
    }

    return sendRedirect(event, `${target}${url.search}`, 301)
})
