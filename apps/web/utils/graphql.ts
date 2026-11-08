import { GraphQLClient, type RequestDocument } from 'graphql-request'
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

/** Thrown when an attempt passes `abortAfterMs`. The server may still finish the request. */
class RequestTimeoutError extends Error {
    constructor(abortAfterMs: number) {
        super(`Request timed out after ${abortAfterMs}ms`)
        this.name = 'RequestTimeoutError'
    }
}

/** Rejects if the request has not settled in time, so a hung connection cannot stall a caller. */
async function withTimeout<T>(request: Promise<T>, abortAfterMs?: number): Promise<T> {
    if (!abortAfterMs) {
        return request
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    try {
        return await Promise.race([
            request,
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new RequestTimeoutError(abortAfterMs)), abortAfterMs)
            })
        ])
    } finally {
        if (timer) clearTimeout(timer)
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
    gqlClientRequestFunction: (
        queryOrMutation: RequestDocument,
        variables?: unknown,
        requestHeaders?: HeadersInit
    ) => Promise<T>,
    queryOrMutation: RequestDocument,
    variables: unknown,
    retryOptions?: graphQLClientRequestWithRetryOptions
): Promise<ServerResponse<T>> => {
    let attempts = 0
    const isMutation = isGraphQLMutation(queryOrMutation)
    const retryAmount = isMutation ? 0 : retryOptions?.retryAmount ?? 0
    const requestTimeoutInMilliseconds = retryOptions?.requestTimeoutInMilliseconds ?? 5000

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
             * Execute our actual HTTP request.
             *
             * `abortAfterMs` bounds how long one attempt may hang. Without it a connection the
             * server accepts and then never answers produced a promise that never settled, and
             * any caller waiting on it (the search page's loading state, for one) waited forever.
             */
            const rawResponseData = await withTimeout(
                gqlClientRequestFunction(queryOrMutation, variables, requestHeaders),
                retryOptions?.abortAfterMs
            )

            // If the request is successful, return the data in the standardized `ServerResponse` format
            return {
                data: rawResponseData,
                errors: [],
                hasErrors: false
            } satisfies ServerResponse<T>
        } catch (error) {
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

            return { data: {} as T, errors, hasErrors: true }
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
    /** Fail an attempt that has not responded in this long. Without it a hung request never settles. */
    abortAfterMs?: number
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
