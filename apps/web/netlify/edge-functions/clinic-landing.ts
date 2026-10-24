import { graphqlEndpoint } from '../../utils/graphqlEndpoint.ts'
import {
    clinicHostLandingTarget,
    clinicLandingAccess,
    clinicLandingMode,
    clinicLandingPreviewCookie,
    clinicLandingPreviewCookieHeader,
    clinicLandingRedirectTarget
} from '../../utils/clinicLanding.ts'
import { hostedClinicForPath, hostedClinicIndex } from '../../utils/hostedClinicIndex.ts'

type EdgeContext = {
    next: () => Promise<Response>
    rewrite: (path: string) => Promise<Response>
}

declare const Netlify: {
    env: {
        get: (name: string) => string | undefined
    }
}

/**
 * Static hosting never runs the Vue redirect, and a missing clinic file is a 404
 * before any page loads. The clinic list comes from the API. A directory page
 * that is not one of those clinics is left alone.
 */
export default async function clinicLanding(request: Request, context: EdgeContext): Promise<Response> {
    const url = new URL(request.url)
    const mode = clinicLandingMode(Netlify.env.get('NUXT_PUBLIC_ONLINE_CLINIC'))
    const hostTarget = clinicHostLandingTarget(url.hostname, url.pathname, mode)
    if (hostTarget) {
        const headers = new Headers({
            location: `${hostTarget}${url.search}`,
            'cache-control': 'public, max-age=3600'
        })
        if (url.searchParams.get('preview') === '1') {
            headers.append('set-cookie', clinicLandingPreviewCookieHeader(url.protocol === 'https:'))
        }
        return new Response(null, { status: 301, headers })
    }

    if (!url.pathname.includes('/clinic/')) {
        return context.next()
    }

    const sites = await hostedClinicIndex(graphqlEndpoint(Netlify.env.get('NUXT_USE_LOCAL_API')))
    const redirectTarget = clinicLandingRedirectTarget(`${url.pathname}${url.search}`, mode, sites)
    if (redirectTarget) {
        const headers = new Headers({
            location: redirectTarget,
            'cache-control': 'public, max-age=3600'
        })
        if (url.searchParams.get('preview') === '1') {
            headers.append('set-cookie', clinicLandingPreviewCookieHeader(url.protocol === 'https:'))
        }
        return new Response(null, { status: 301, headers })
    }

    const site = hostedClinicForPath(url.pathname, sites)
    const published = mode === 'public' && site?.status === 'PUBLISHED'
    if (!site || published) {
        return context.next()
    }

    const access = clinicLandingAccess(
        mode,
        url.searchParams.get('preview'),
        clinicLandingPreviewCookie(request.headers.get('cookie'))
    )

    if (access === 'deny' || access === 'revoke') {
        const notFound = await context.rewrite('/404.html')
        const headers = new Headers(notFound.headers)
        headers.set('cache-control', 'private, no-store')
        if (access === 'revoke') {
            headers.append('set-cookie', clinicLandingPreviewCookieHeader(url.protocol === 'https:', true))
        }
        return new Response(notFound.body, { status: 404, headers })
    }

    const response = await context.next()
    const headers = new Headers(response.headers)
    headers.set('cache-control', 'private, no-store')
    headers.set('vary', 'Cookie')
    if (access === 'grant') {
        headers.append('set-cookie', clinicLandingPreviewCookieHeader(url.protocol === 'https:'))
    }
    return new Response(response.body, { status: response.status, headers })
}
