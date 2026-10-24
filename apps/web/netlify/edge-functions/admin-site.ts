import {
    adminHostTarget,
    adminSiteAccess,
    adminSiteMode,
    adminSitePreviewCookie,
    adminSitePreviewCookieHeader,
    isAdminHost,
    isAdminPath
} from '../../utils/adminSite.ts'

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
 * `admin.findadoc.jp` uses the same preview cookie as a clinic landing.
 * The function returns immediately for every other host.
 * Off mode is a 404 for the whole admin host. Preview is a 404 without the cookie.
 * The page stays out of search either way.
 */
export default async function adminSite(request: Request, context: EdgeContext): Promise<Response> {
    const url = new URL(request.url)
    if (!isAdminHost(url.hostname)) {
        return context.next()
    }

    const mode = adminSiteMode(Netlify.env.get('NUXT_PUBLIC_ADMIN_SITE'))
    if (mode === 'off') {
        const notFound = await context.rewrite('/404.html')
        const headers = new Headers(notFound.headers)
        headers.set('cache-control', 'private, no-store')
        return new Response(notFound.body, { status: 404, headers })
    }

    const hostTarget = adminHostTarget(url.hostname, url.pathname, mode)
    if (hostTarget) {
        const headers = new Headers({
            location: `${hostTarget}${url.search}`,
            'cache-control': 'public, max-age=3600'
        })
        if (url.searchParams.get('preview') === '1') {
            headers.append('set-cookie', adminSitePreviewCookieHeader(url.protocol === 'https:'))
        }
        return new Response(null, { status: 301, headers })
    }

    if (!isAdminPath(url.pathname)) {
        return context.next()
    }

    const access = adminSiteAccess(
        mode,
        url.searchParams.get('preview'),
        adminSitePreviewCookie(request.headers.get('cookie'))
    )
    if (access === 'deny' || access === 'revoke') {
        const notFound = await context.rewrite('/404.html')
        const headers = new Headers(notFound.headers)
        headers.set('cache-control', 'private, no-store')
        if (access === 'revoke') {
            headers.append('set-cookie', adminSitePreviewCookieHeader(url.protocol === 'https:', true))
        }
        return new Response(notFound.body, { status: 404, headers })
    }

    const response = await context.next()
    const headers = new Headers(response.headers)
    headers.set('cache-control', 'private, no-store')
    headers.append('vary', 'Cookie')
    if (access === 'grant') {
        headers.append('set-cookie', adminSitePreviewCookieHeader(url.protocol === 'https:'))
    }
    return new Response(response.body, { status: response.status, headers })
}
