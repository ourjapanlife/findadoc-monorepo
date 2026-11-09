import { GraphQLClient, type RequestDocument } from 'graphql-request'
import { print, type DocumentNode } from 'graphql'
import { useRuntimeConfig } from '#imports'
import { ErrorCode, type ServerError, type ServerResponse } from '~/typedefs/serverResponse'
import { serverErrorsFromGraphQL } from '~/utils/formErrorMessage'
import { graphqlEndpoint } from './graphqlEndpoint'

// eslint-disable-next-line
export let gqlClient: GraphQLClient

let gqlClientBaseUrl: string | null = null

export const initializeGqlClient = () => {
    const apiURL = graphqlEndpoint(useRuntimeConfig().public.NUXT_USE_LOCAL_API as string | undefined)

    if (gqlClient && gqlClientBaseUrl === apiURL) {
        return
    }

    gqlClientBaseUrl = apiURL
    gqlClient = new GraphQLClient(apiURL)
}

/**
 * Sends one public read as a GET, with no token and no custom header, so CloudFront and the
 * browser may cache it (#242). Only for operations on the API's public list
 * (`PUBLIC_CACHEABLE_QUERY_FIELDS` in apps/server/src/publicCache.ts): the API refuses any
 * other query sent this way. Failures look like graphql-request's, so retry rules still apply.
 */
export async function publicGetRequest<T>(options: {
    document: RequestDocument
    variables?: unknown
    signal?: AbortSignal
}): Promise<T> {
    if (!gqlClientBaseUrl) {
        initializeGqlClient()
    }

    const url = new URL(gqlClientBaseUrl ?? '')
    url.searchParams.set('query', compactQuery(options.document))
    if (options.variables !== undefined) {
        url.searchParams.set('variables', JSON.stringify(options.variables))
    }

    const response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' }, signal: options.signal })
    const body = await response.json().catch(() => null) as {
        data?: T
        errors?: { message: string, extensions?: { [key: string]: unknown } }[]
    } | null

    if (!response.ok || !body || (body.errors?.length ?? 0) > 0 || body.data === undefined) {
        // The same shape as graphql-request's ClientError, which classifyFailure reads.
        throw Object.assign(new Error(`GraphQL GET failed with status ${response.status}`), {
            response: { status: response.status, errors: body?.errors }
        })
    }

    return body.data
}

/**
 * The query text for a URL. Runs of whitespace become one space, so the URL is short and two
 * spellings of the same query share a cache entry. A query with a string literal is left as is.
 */
function compactQuery(document: RequestDocument): string {
    const text = typeof document === 'string' ? document : print(document as DocumentNode)
    return text.includes('"') ? text : text.replace(/\s+/g, ' ').trim()
}

/**
 * How to send a public read: a cacheable GET in the browser (#242). A prerender keeps POST,
 * so the HTML it writes is built from the API, not from an edge copy up to minutes old.
 */
export function publicReadRequest<T>(): GraphQLRequestFunction<T> {
    return import.meta.client ? publicGetRequest<T> : gqlClient.request.bind(gqlClient) as GraphQLRequestFunction<T>
}

/** An attempt passed `abortAfterMs`. The fetch is aborted, but a write the server already got may still land. */
class RequestTimeoutError extends Error {
    constructor(abortAfterMs: number) {
        super(`Request timed out after ${abortAfterMs}ms`)
        this.name = 'RequestTimeoutError'
    }
}

/** The deadline for one attempt when the caller names none. No request may hang forever (#219). */
export const DEFAULT_ABORT_AFTER_MS = 15000

/** One attempt, as graphql-request's object form takes it: `gqlClient.request.bind(gqlClient)`. */
export type GraphQLRequestFunction<T> = (options: {
    document: RequestDocument
    variables?: unknown
    requestHeaders?: HeadersInit
    signal?: AbortSignal
}) => Promise<T>

/** The caller cancelled the request, such as vue-query when the page that asked for it is gone (#242). */
class RequestCancelledError extends Error {
    constructor() {
        super('Request cancelled')
        this.name = 'RequestCancelledError'
    }
}

/**
 * Runs one attempt with a deadline. At the deadline the fetch is aborted, so the browser stops
 * waiting and drops the connection, and the attempt rejects with `RequestTimeoutError` (#219).
 * When the caller's `callerSignal` aborts first, the fetch is aborted the same way and the
 * attempt rejects with `RequestCancelledError` (#242).
 */
async function withAbortDeadline<T>(
    send: (signal: AbortSignal) => Promise<T>,
    abortAfterMs: number,
    callerSignal?: AbortSignal
): Promise<T> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelFromCaller: (() => void) | undefined

    try {
        return await Promise.race([
            send(controller.signal),
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => {
                    reject(new RequestTimeoutError(abortAfterMs))
                    controller.abort()
                }, abortAfterMs)

                cancelFromCaller = () => {
                    reject(new RequestCancelledError())
                    controller.abort()
                }
                if (callerSignal?.aborted) {
                    cancelFromCaller()
                } else {
                    callerSignal?.addEventListener('abort', cancelFromCaller, { once: true })
                }
            })
        ])
    } finally {
        if (timer) clearTimeout(timer)
        if (cancelFromCaller) callerSignal?.removeEventListener('abort', cancelFromCaller)
    }
}

// Leading `#` comment lines are allowed before the operation keyword.
const MUTATION_PATTERN = /^\s*(?:#[^\n]*\n\s*)*mutation\b/i
const OPERATION_NAME_PATTERN = /^\s*(?:#[^\n]*\n\s*)*(?:query|mutation|subscription)\s+([_A-Za-z]\w*)/

type DocumentLike = {
    definitions?: readonly { kind?: string, operation?: string, name?: { value?: string } }[]
    loc?: { source?: { body?: string } }
}

function documentBody(document: RequestDocument): string | undefined {
    if (typeof document === 'string') {
        return document
    }
    const body = (document as DocumentLike).loc?.source?.body
    return typeof body === 'string' ? body : undefined
}

/**
 * A mutation is never retried (#219). One that timed out or lost its connection may already
 * have been applied, and a second send can create a duplicate or apply a moderation change twice.
 */
function isGraphQLMutation(document: RequestDocument): boolean {
    if (typeof document !== 'string' && (document as DocumentLike).definitions?.some(definition =>
        definition.kind === 'OperationDefinition' && definition.operation === 'mutation')) {
        return true
    }

    const body = documentBody(document)
    return body !== undefined && MUTATION_PATTERN.test(body)
}

/** The operation name for the log line, such as `CreateSubmission`. Never the variables. */
function operationNameOf(document: RequestDocument): string {
    if (typeof document !== 'string') {
        const named = (document as DocumentLike).definitions?.find(definition =>
            definition.kind === 'OperationDefinition' && typeof definition.name?.value === 'string')
        if (named?.name?.value) {
            return named.name.value
        }
    }

    return documentBody(document)?.match(OPERATION_NAME_PATTERN)?.[1] ?? 'anonymous'
}

/** Gateway answers that mean the API did not get to answer. Another try may get through. */
const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([502, 503, 504])

type ClientErrorLike = {
    response?: {
        status?: unknown
        errors?: readonly { message: string, extensions?: { readonly [key: string]: unknown } }[]
    }
}

type FailureKind = 'graphql' | 'timeout' | 'network' | 'transientHttp' | 'other'

/**
 * Sorts a failed attempt. Only a timeout, a dropped connection, or a 502/503/504 with no
 * GraphQL errors might clear up on a second try (#219). A GraphQL error, any other HTTP
 * status, or a response we could not read is the same answer the next time.
 */
function classifyFailure(error: unknown): FailureKind {
    if (error instanceof RequestTimeoutError) {
        return 'timeout'
    }

    const response = (error as ClientErrorLike | null)?.response
    if (response !== undefined && response !== null && typeof response === 'object') {
        if (Array.isArray(response.errors) && response.errors.length > 0) {
            return 'graphql'
        }
        return typeof response.status === 'number' && TRANSIENT_HTTP_STATUSES.has(response.status)
            ? 'transientHttp'
            : 'other'
    }

    // fetch rejects with a TypeError when the connection fails or drops.
    return error instanceof TypeError ? 'network' : 'other'
}

const RETRYABLE_FAILURES: ReadonlySet<FailureKind> = new Set(['timeout', 'network', 'transientHttp'])

/**
 * The errors to hand back. The message is fixed text: a graphql-request `ClientError` message
 * repeats the request and its variables, which can hold a name, an email, or a phone number.
 */
function errorsForFailure(error: unknown, kind: FailureKind, isMutation: boolean): ServerError[] {
    const errors = serverErrorsFromGraphQL((error as ClientErrorLike | null)?.response?.errors)
    if (errors.length > 0) {
        return errors
    }

    // A write that got no answer may still have been saved. Say so, instead of inviting a second submit.
    if (isMutation && RETRYABLE_FAILURES.has(kind)) {
        return [{ message: 'The change may have been saved', code: ErrorCode.WRITE_OUTCOME_UNKNOWN, field: undefined }]
    }

    return [{ message: kind === 'timeout' ? 'Request timed out' : 'Request failed', code: ErrorCode.NETWORK, field: undefined }]
}

/**
 * Sends one GraphQL request and returns a `ServerResponse`.
 *
 * Nothing is retried unless the caller passes `retryAmount` (#219). A mutation is never
 * retried, whatever `retryAmount` says, and a query is retried only on a timeout, a dropped
 * connection, or a 502/503/504.
 */
export const graphQLClientRequestWithRetry = async <T>(
    gqlClientRequestFunction: GraphQLRequestFunction<T>,
    queryOrMutation: RequestDocument,
    variables: unknown,
    retryOptions?: graphQLClientRequestWithRetryOptions
): Promise<ServerResponse<T>> => {
    let attempts = 0
    const isMutation = isGraphQLMutation(queryOrMutation)
    const retryAmount = isMutation ? 0 : retryOptions?.retryAmount ?? 0
    const requestTimeoutInMilliseconds = retryOptions?.requestTimeoutInMilliseconds ?? 5000
    const abortAfterMs = retryOptions?.abortAfterMs ?? DEFAULT_ABORT_AFTER_MS

    const executeGQLClientRequest = async (): Promise<ServerResponse<T>> => {
        try {
            /*
             * Public reads skip the token lookup entirely. getAuthBearerToken() awaits Auth0
             * initialisation (up to 10 s), which used to sit in front of every anonymous search
             * request — the whole waterfall serialised behind an SDK the visitor never uses.
             */
            const authToken = retryOptions?.skipAuth
                ? undefined
                : await useAuthStore().getAuthBearerToken()
            // Set the auth token in the request headers. This is used to authenticate the user with the API
            const requestHeaders = {
                authorization: authToken ? `Bearer ${authToken}` : ''
            } satisfies HeadersInit

            /*
             * Execute our actual HTTP request. Every attempt has a deadline, and the fetch is
             * aborted when it passes. Without one, a connection the server accepted and then
             * never answered left the caller (the search page's loading state, for one) waiting forever.
             */
            const rawResponseData = await withAbortDeadline(
                signal => gqlClientRequestFunction({ document: queryOrMutation, variables, requestHeaders, signal }),
                abortAfterMs,
                retryOptions?.signal
            )

            // If the request is successful, return the data in the standardized `ServerResponse` format
            return {
                data: rawResponseData,
                errors: [],
                hasErrors: false
            } satisfies ServerResponse<T>
        } catch (error) {
            if (error instanceof RequestCancelledError) {
                // Nobody is waiting for this answer, so there is nothing to retry or log.
                return {
                    data: {} as T,
                    errors: [{ message: error.message, code: ErrorCode.NETWORK, field: undefined }],
                    hasErrors: true,
                    temporary: false
                }
            }

            const kind = classifyFailure(error)
            if (attempts < retryAmount && RETRYABLE_FAILURES.has(kind)) {
                attempts++
                if (attempts > 1) {
                    await new Promise(resolve => setTimeout(resolve, requestTimeoutInMilliseconds))
                }
                return executeGQLClientRequest()
            }

            const errors = errorsForFailure(error, kind, isMutation)
            // The operation name and the codes only. The error object can repeat the variables.
            const codes = [...new Set(errors.map(serverError => serverError.code))].join(',')
            console.error(`GraphQL request ${operationNameOf(queryOrMutation)} failed: ${codes}`)

            return { data: {} as T, errors, hasErrors: true, temporary: RETRYABLE_FAILURES.has(kind) }
        }
    }
    return executeGQLClientRequest()
}
export interface graphQLClientRequestWithRetryOptions {
    requestTimeoutInMilliseconds?: number
    /** Retries after a timeout, a dropped connection, or a 502/503/504. Default 0. Ignored for a mutation. */
    retryAmount?: number
    /** Send no bearer token and do not wait for Auth0. For operations the API serves without a session. */
    skipAuth?: boolean
    /** Abort an attempt that has not responded in this long. Default `DEFAULT_ABORT_AFTER_MS`. */
    abortAfterMs?: number
    /** The caller's cancel signal, such as the one vue-query passes to a `queryFn` (#242). */
    signal?: AbortSignal
}
export interface gqlMutation<T> extends gqlRequest {
    variables: {
        input: T
    }
}

export interface gqlRequest {
    query: string
    variables: unknown
}
