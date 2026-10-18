/** Auth0 API identifier — must match the findadoc API in Auth0 and the server JWT audience. */
export const AUTH0_API_AUDIENCE = 'findadoc'

export const AUTH0_DOMAIN = 'findadoc.jp.auth0.com'
export const AUTH0_CLIENT_ID = 'HB5Jow9yA5yiA4LTPQCKBYrfDyRkO9JX'

/**
 * The SDK default cache is memory. A reload empties it, and Auth0 then tries to
 * restore the session through an iframe on findadoc.jp.auth0.com. That cookie is
 * third-party on localhost, so the browser blocks it and the user is logged out.
 * localstorage keeps the tokens on this origin across a refresh.
 */
export const AUTH0_CACHE_LOCATION = 'localstorage' as const

const LOGIN_PATH = '/login'
export const AUTH_RETURN_TO_QUERY = 'returnTo'

export function getAuth0AuthorizationParams(redirectUri?: string) {
    return {
        audience: AUTH0_API_AUDIENCE,
        // eslint-disable-next-line camelcase
        redirect_uri: redirectUri ?? (import.meta.client ? window.location.origin : '')
    }
}

/** Reject unsafe or recursive post-login targets. */
export function sanitizeAuthReturnPath(path: string | null | undefined): string | null {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
        return null
    }

    const [pathname] = path.split('?')
    if (pathname === LOGIN_PATH || (pathname && pathname.startsWith(`${LOGIN_PATH}/`))) {
        return null
    }

    return path
}

/**
 * Resolve where to send the user after Auth0 login.
 * On `/login`, honors `?returnTo=`; otherwise uses the current route.
 */
export function resolveAuthReturnPath(currentFullPath: string): string {
    const [pathname, search = ''] = currentFullPath.split('?')

    if (pathname === LOGIN_PATH || (pathname && pathname.startsWith(`${LOGIN_PATH}/`))) {
        if (search) {
            const returnTo = sanitizeAuthReturnPath(
                new URLSearchParams(search).get(AUTH_RETURN_TO_QUERY)
            )
            if (returnTo) {
                return returnTo
            }
        }

        return '/'
    }

    return sanitizeAuthReturnPath(currentFullPath) ?? '/'
}

export function getAuth0ClientOptions(redirectUri?: string) {
    return {
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        cacheLocation: AUTH0_CACHE_LOCATION,
        authorizationParams: getAuth0AuthorizationParams(redirectUri)
    }
}

export function buildLoginRoute(returnTo: string) {
    return {
        path: LOGIN_PATH,
        query: {
            [AUTH_RETURN_TO_QUERY]: sanitizeAuthReturnPath(returnTo) ?? '/'
        }
    }
}

export function isAuth0ConsentRequiredError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const auth0Error = error as { error?: string, error_description?: string, message?: string }
    return auth0Error.error === 'consent_required'
      || auth0Error.error_description === 'Consent required'
      || auth0Error.message?.includes('consent_required') === true
      || auth0Error.message?.includes('Consent required') === true
}
