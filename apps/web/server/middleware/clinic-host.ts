import { defineEventHandler, getRequestURL, sendRedirect } from 'h3'
import { clinicHostLandingTarget, clinicLandingMode } from '~/utils/clinicLanding'

/**
 * Dev, and any server render. Netlify static hosting uses the edge function
 * for the same redirect. The browser stays on the clinic hostname.
 */
export default defineEventHandler(event => {
    const url = getRequestURL(event)
    const target = clinicHostLandingTarget(
        url.hostname,
        url.pathname,
        clinicLandingMode(process.env.NUXT_PUBLIC_ONLINE_CLINIC)
    )
    if (!target) {
        return
    }

    return sendRedirect(event, `${target}${url.search}`, 301)
})
