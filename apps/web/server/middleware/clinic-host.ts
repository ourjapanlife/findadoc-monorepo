import { defineEventHandler, getRequestURL, sendRedirect } from 'h3'
import { useRuntimeConfig } from '#imports'
import { clinicHostLandingTarget, clinicLandingMode } from '~/utils/clinicLanding'

/**
 * Dev, and any server render. Netlify static hosting uses the edge function
 * for the same redirect. The browser stays on the clinic hostname.
 * The mode comes from runtime config, so `pnpm dev` and the browser agree.
 */
export default defineEventHandler(event => {
    const url = getRequestURL(event)
    const config = useRuntimeConfig(event)
    const target = clinicHostLandingTarget(
        url.hostname,
        url.pathname,
        clinicLandingMode(config.public.onlineClinic)
    )
    if (!target) {
        return
    }

    return sendRedirect(event, `${target}${url.search}`, 301)
})
