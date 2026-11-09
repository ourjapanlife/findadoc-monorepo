import { QueryClient } from '@tanstack/vue-query'
import type { RequestDocument } from 'graphql-request'
import type { ServerError } from '~/typedefs/serverResponse'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql'

/**
 * Directory data changes when a moderator approves something, a few times a week (#242).
 * Within this window a second read of the same key is served from memory with no request.
 */
export const DIRECTORY_STALE_TIME_MS = 5 * 60 * 1000

/** How long an unused directory read stays in memory, so Back to /search shows results at once. */
export const DIRECTORY_GC_TIME_MS = 30 * 60 * 1000

/** At most one retry for a query, and only for a temporary failure (#219). */
export const MAX_QUERY_RETRIES = 1

const MAX_RETRY_DELAY_MS = 8000

/** A query that came back with errors. vue-query needs a rejected promise to see the failure. */
export class QueryRequestError extends Error {
    readonly errors: ServerError[]
    /** A timeout, a dropped connection, or a 502/503/504. Another try may get through (#219). */
    readonly temporary: boolean

    constructor(errors: ServerError[], temporary: boolean) {
        // Codes only. A server message can repeat the input.
        super(`Query failed: ${[...new Set(errors.map(error => error.code))].join(',') || 'unknown'}`)
        this.name = 'QueryRequestError'
        this.errors = errors
        this.temporary = temporary
    }
}

/**
 * The retry rule for every query (#219, #242). One more try after a timeout, a dropped
 * connection, or a 502/503/504. A GraphQL error or any other failure is not retried: the same
 * request gets the same answer.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    return failureCount < MAX_QUERY_RETRIES && error instanceof QueryRequestError && error.temporary
}

/** Exponential backoff: 1 s, 2 s, 4 s, then capped. */
export function queryRetryDelay(attemptIndex: number): number {
    return Math.min(1000 * 2 ** attemptIndex, MAX_RETRY_DELAY_MS)
}

/**
 * The app's one query client (#242). Mutations are never retried (#219). A read that is not
 * directory data is stale at once, so moderation and booking always ask the server again.
 * Directory reads set `DIRECTORY_STALE_TIME_MS` themselves.
 *
 * There is no persister. Server data stays in memory, never in browser storage (AGENTS.md).
 */
export function createAppQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: shouldRetryQuery,
                retryDelay: queryRetryDelay,
                staleTime: 0,
                refetchOnWindowFocus: false
            },
            mutations: {
                retry: 0
            }
        }
    })
}

export interface QueryRequestOptions {
    /** The signal vue-query passes to the `queryFn`. Aborts the fetch when nobody needs the answer. */
    signal?: AbortSignal
    /** Send no bearer token and do not wait for Auth0. For reads the API serves without a session. */
    skipAuth?: boolean
    /** Abort an attempt that has not responded in this long. */
    abortAfterMs?: number
}

/**
 * Runs one GraphQL query for a vue-query `queryFn` and returns its data, or throws
 * `QueryRequestError`. It makes one attempt: vue-query owns the retry, through `shouldRetryQuery`.
 */
export async function requestQueryData<T>(
    document: RequestDocument,
    variables: unknown,
    options: QueryRequestOptions = {}
): Promise<T> {
    const response = await graphQLClientRequestWithRetry<T>(
        gqlClient.request.bind(gqlClient),
        document,
        variables,
        { ...options, retryAmount: 0 }
    )

    if (response.hasErrors) {
        throw new QueryRequestError(response.errors ?? [], response.temporary === true)
    }

    return response.data
}

/**
 * Drops every cached read and stops the ones in flight. Called on sign-out, so moderation or
 * booking data a signed-in user loaded does not stay in memory after they leave (#242).
 */
export function clearQueryCache(queryClient: QueryClient): void {
    void queryClient.cancelQueries()
    queryClient.clear()
}
