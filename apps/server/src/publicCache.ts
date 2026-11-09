import type { ApolloServerPlugin, GraphQLRequestContext } from '@apollo/server'
import { GraphQLError, Kind, type OperationDefinitionNode } from 'graphql'
import { ANONYMOUS_USER_SUB, type UserContext } from './auth.js'

/**
 * Root query fields whose answer is the same for every signed-out visitor (#242). A response
 * made only of these fields may be cached by CloudFront and the browser.
 *
 * A field belongs here only when its resolver reads no caller data: not the user, the IP,
 * the viewer country, or a rate limit, and has no side effect. `resolverScopes.test.ts`
 * checks that an anonymous visitor may read every one. Booking, upload, moderation, and
 * user fields never belong here.
 */
export const PUBLIC_CACHEABLE_QUERY_FIELDS: ReadonlySet<string> = new Set([
    'facility',
    'facilities',
    'facilitiesTotalCount',
    'healthcareProfessional',
    'healthcareProfessionals',
    'healthcareProfessionalsTotalCount',
    'cityFacilities',
    'cities',
    'prefectures',
    'publishedLanguages',
    'clinicSite',
    'clinicSites',
    '__typename',
    '__type',
    '__schema'
])

/** A moderator's approval shows up within a minute without an invalidation (#242). */
export const PUBLIC_MAX_AGE_SECONDS = 60

/** After `max-age`, the edge may serve the old answer this long while it fetches a new one. */
export const PUBLIC_STALE_WHILE_REVALIDATE_SECONDS = 300

export const PUBLIC_CACHE_CONTROL =
    `public, max-age=${PUBLIC_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_STALE_WHILE_REVALIDATE_SECONDS}`

export const PRIVATE_CACHE_CONTROL = 'private, no-store'

/**
 * Headers that make a browser preflight the request, as Apollo's CSRF prevention names them.
 * A cross-site form or `<img>` cannot send either.
 */
export const PREFLIGHT_HEADERS = ['x-apollo-operation-name', 'apollo-require-preflight'] as const

const SIMPLE_CONTENT_TYPES: ReadonlySet<string> = new Set([
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain'
])

interface HeaderReader {
    get(name: string): string | undefined
}

/**
 * The root field names of a query, or null when it is not a plain query: a mutation, a
 * subscription, or a root selection that uses a fragment.
 */
export function rootQueryFields(operation: OperationDefinitionNode | undefined): string[] | null {
    if (operation?.operation !== 'query') {
        return null
    }

    const names: string[] = []
    for (const selection of operation.selectionSet.selections) {
        if (selection.kind !== Kind.FIELD) {
            return null
        }
        names.push(selection.name.value)
    }

    return names
}

/** True when every root field is on the public list. */
export function isPublicQuery(operation: OperationDefinitionNode | undefined): boolean {
    const fields = rootQueryFields(operation)
    return fields !== null && fields.length > 0 && fields.every(field => PUBLIC_CACHEABLE_QUERY_FIELDS.has(field))
}

/** No bearer token was sent, and the API treated the caller as the anonymous visitor. */
export function isAnonymousRequest(headers: HeaderReader | undefined, user: UserContext['user']): boolean {
    const authorization = headers?.get('authorization')
    return (authorization === undefined || authorization.trim() === '') && user.sub === ANONYMOUS_USER_SUB
}

/**
 * Apollo's CSRF rule (#242). A browser sends a request without a preflight only when its
 * content type is a form type or empty, and it carries no custom header. Such a request is
 * one a cross-site page could forge.
 */
export function isPreflightedRequest(headers: HeaderReader | undefined): boolean {
    const contentType = headers?.get('content-type')
    if (contentType !== undefined && contentType !== '') {
        const mimeType = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
        if (!SIMPLE_CONTENT_TYPES.has(mimeType)) {
            return true
        }
    }

    return PREFLIGHT_HEADERS.some(name => {
        const value = headers?.get(name)
        return value !== undefined && value !== ''
    })
}

/**
 * The `Cache-Control` value for one response. Public only for an anonymous query made of
 * public fields that answered with no errors. Anything else is never stored.
 */
export function cacheControlFor(input: {
    operation: OperationDefinitionNode | undefined
    isAnonymous: boolean
    hasErrors: boolean
}): string {
    return input.isAnonymous && !input.hasErrors && isPublicQuery(input.operation)
        ? PUBLIC_CACHE_CONTROL
        : PRIVATE_CACHE_CONTROL
}

/**
 * Sets `Cache-Control` on every GraphQL response (#242). It replaces Apollo's cache-control
 * plugin: the hints are one list of root fields, not a directive on every type.
 */
export function publicCachePlugin<TContext extends UserContext>(): ApolloServerPlugin<TContext> {
    return {
        async requestDidStart() {
            return {
                async willSendResponse(requestContext: GraphQLRequestContext<TContext>) {
                    const http = requestContext.response.http
                    const headers = requestContext.request.http?.headers
                    const body = requestContext.response.body
                    // An incremental (deferred) answer is not cached: its later parts are not known yet.
                    const hasErrors = (requestContext.errors?.length ?? 0) > 0
                        || body?.kind !== 'single'
                        || (body.singleResult.errors?.length ?? 0) > 0

                    const cacheControl = cacheControlFor({
                        operation: requestContext.operation ?? undefined,
                        isAnonymous: isAnonymousRequest(headers, requestContext.contextValue.user),
                        hasErrors
                    })

                    http.headers.set('cache-control', cacheControl)
                    if (cacheControl === PUBLIC_CACHE_CONTROL) {
                        // A browser keeps one copy per site and per token. CloudFront keys on the same.
                        http.headers.set('vary', 'Origin, Authorization')
                    }
                }
            }
        }
    }
}

/**
 * CSRF prevention that lets a public read skip the preflight (#242).
 *
 * Apollo's own check makes every GET send a custom header, so the browser sends an OPTIONS
 * request first, once per URL. A public read is the same for everyone, has no side effect, and
 * CORS keeps a cross-site page from reading the answer, so it is safe without one. Every
 * other operation keeps Apollo's rule: a request that was not preflighted is refused before
 * it runs.
 */
export function csrfPreventionPlugin<TContext extends UserContext>(): ApolloServerPlugin<TContext> {
    return {
        async requestDidStart() {
            return {
                async didResolveOperation(requestContext: GraphQLRequestContext<TContext>) {
                    if (isPreflightedRequest(requestContext.request.http?.headers)) {
                        return
                    }
                    if (isPublicQuery(requestContext.operation ?? undefined)) {
                        return
                    }

                    throw new GraphQLError(
                        `This operation needs a preflighted request: send it as JSON or with ${PREFLIGHT_HEADERS[0]}.`,
                        { extensions: { code: 'BAD_REQUEST', http: { status: 400 } } }
                    )
                }
            }
        }
    }
}
