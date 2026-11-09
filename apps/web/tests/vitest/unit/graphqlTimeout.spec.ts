import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { gql } from 'graphql-request'
import { DEFAULT_ABORT_AFTER_MS, graphQLClientRequestWithRetry } from '~/utils/graphql'

/*
 * The retry loop only fires on rejection, so before `abortAfterMs` a connection the server
 * accepted and then never answered produced a promise that never settled. The search page sat
 * on skeletons indefinitely with no error. Every attempt now has a deadline and is aborted at it (#219).
 */
describe('graphQLClientRequestWithRetry: per-attempt deadline', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    /*
     * retryAmount 0 is a single attempt. 1 allows one retry. An omitted value is a single attempt (#219).
     */
    const publicOptions = { skipAuth: true, retryAmount: 1, requestTimeoutInMilliseconds: 1 }

    it('gives up on a request that never responds and reports an error', async () => {
        const neverSettles = () => new Promise<never>(() => {})

        const result = graphQLClientRequestWithRetry(
            neverSettles,
            'query Q { x }',
            {},
            { ...publicOptions, abortAfterMs: 10000 }
        )

        // Two attempts at the 10 s deadline, plus the gap between them.
        await vi.advanceTimersByTimeAsync(20101)

        await expect(result).resolves.toMatchObject({ hasErrors: true })
    })

    it('returns data normally when the request answers in time', async () => {
        const responds = () => Promise.resolve({ x: 1 })

        const result = graphQLClientRequestWithRetry(
            responds,
            'query Q { x }',
            {},
            { ...publicOptions, abortAfterMs: 10000 }
        )
        await vi.advanceTimersByTimeAsync(1)

        await expect(result).resolves.toMatchObject({ hasErrors: false, data: { x: 1 } })
    })

    it('gives up at the default deadline when the caller names none', async () => {
        const slow = () => new Promise<{ x: number }>(resolve => setTimeout(() => resolve({ x: 1 }), 60000))

        const result = graphQLClientRequestWithRetry(slow, 'query Q { x }', {}, { skipAuth: true })
        await vi.advanceTimersByTimeAsync(DEFAULT_ABORT_AFTER_MS + 1)

        await expect(result).resolves.toMatchObject({ hasErrors: true, errors: [{ code: 'NETWORK' }] })
    })

    it('aborts the fetch when the deadline passes', async () => {
        let signal: AbortSignal | undefined
        const neverSettles = (options: { signal?: AbortSignal }) => {
            signal = options.signal
            return new Promise<never>(() => {})
        }

        const result = graphQLClientRequestWithRetry(
            neverSettles,
            'mutation CreateSubmission { createSubmission { id } }',
            { input: { notes: 'fake' } },
            { skipAuth: true, abortAfterMs: 1000 }
        )
        expect(signal?.aborted).toBe(false)

        await vi.advanceTimersByTimeAsync(1001)

        expect(signal?.aborted).toBe(true)
        await expect(result).resolves.toMatchObject({ errors: [{ code: 'WRITE_OUTCOME_UNKNOWN' }] })
    })

    it('sends the document, variables, and signal in the object form', async () => {
        const request = vi.fn((_options: { document: unknown, variables?: unknown, signal?: AbortSignal }) =>
            Promise.resolve({ x: 1 }))

        await graphQLClientRequestWithRetry(request, 'query Q { x }', { id: 'abc' }, { skipAuth: true })

        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            document: 'query Q { x }',
            variables: { id: 'abc' },
            signal: expect.any(AbortSignal)
        }))
    })
})

function clientError(status: number, errors?: { message: string, extensions?: { code: string } }[]) {
    return Object.assign(new Error('GraphQL Error: {"request":{"variables":{"email":"someone@example.com"}}}'), {
        response: { status, ...(errors === undefined ? {} : { errors }) }
    })
}

function countingFailure(error: unknown) {
    const counter = { calls: 0 }
    const request = () => {
        counter.calls += 1
        return Promise.reject(error)
    }
    return { counter, request }
}

const QUERY = 'query FacilitiesAndCount { x }'
const MUTATION = 'mutation CreateSubmission($input: CreateSubmissionInput!) { createSubmission(input: $input) { id } }'

describe('graphQLClientRequestWithRetry: mutations', () => {
    it('sends a mutation once, even when it fails and retryAmount is set', async () => {
        const { counter, request } = countingFailure(new TypeError('Failed to fetch'))

        const result = await graphQLClientRequestWithRetry(
            request,
            MUTATION,
            {},
            { skipAuth: true, retryAmount: 3, requestTimeoutInMilliseconds: 1 }
        )

        expect(counter.calls).toBe(1)
        expect(result.hasErrors).toBe(true)
    })

    it('sends a parsed mutation document once', async () => {
        const { counter, request } = countingFailure(new TypeError('Failed to fetch'))

        await graphQLClientRequestWithRetry(
            request,
            gql`mutation UpdateSubmission { updateSubmission { id } }`,
            {},
            { skipAuth: true, retryAmount: 3, requestTimeoutInMilliseconds: 1 }
        )

        expect(counter.calls).toBe(1)
    })

    it('says a write that timed out may have been saved', async () => {
        vi.useFakeTimers()
        try {
            const result = graphQLClientRequestWithRetry(
                () => new Promise<never>(() => {}),
                MUTATION,
                {},
                { skipAuth: true, abortAfterMs: 1000 }
            )
            await vi.advanceTimersByTimeAsync(1001)

            await expect(result).resolves.toEqual({
                data: {},
                hasErrors: true,
                errors: [{ message: 'The change may have been saved', code: 'WRITE_OUTCOME_UNKNOWN', field: undefined }]
            })
        } finally {
            vi.useRealTimers()
        }
    })

    it('says a write whose connection dropped may have been saved', async () => {
        const { request } = countingFailure(new TypeError('Failed to fetch'))

        const result = await graphQLClientRequestWithRetry(request, MUTATION, {}, { skipAuth: true })

        expect(result.errors).toEqual([
            { message: 'The change may have been saved', code: 'WRITE_OUTCOME_UNKNOWN', field: undefined }
        ])
    })

    it('keeps a GraphQL error from a mutation instead of calling it a network failure', async () => {
        const { request } = countingFailure(clientError(200, [{ message: 'nope', extensions: { code: 'SERVER_ERROR' } }]))

        const result = await graphQLClientRequestWithRetry(request, MUTATION, {}, { skipAuth: true })

        expect(result.errors).toEqual([{ message: 'nope', code: 'SERVER_ERROR', field: undefined }])
        expect(result.hasErrors).toBe(true)
    })
})

describe('graphQLClientRequestWithRetry: which query failures are retried', () => {
    const retryOnce = { skipAuth: true, retryAmount: 1, requestTimeoutInMilliseconds: 1 }

    it('sends a query once when no retryAmount is passed', async () => {
        const { counter, request } = countingFailure(new TypeError('Failed to fetch'))

        const result = await graphQLClientRequestWithRetry(request, QUERY, {}, { skipAuth: true })

        expect(counter.calls).toBe(1)
        expect(result.errors).toEqual([{ message: 'Request failed', code: 'NETWORK', field: undefined }])
    })

    it('retries a network error when the caller sets retryAmount', async () => {
        const { counter, request } = countingFailure(new TypeError('Failed to fetch'))

        await graphQLClientRequestWithRetry(request, QUERY, {}, retryOnce)

        expect(counter.calls).toBe(2)
    })

    it('does not retry a query that gets a GraphQL error from the API', async () => {
        const { counter, request } = countingFailure(
            clientError(400, [{ message: 'bad', extensions: { code: 'BAD_USER_INPUT' } }])
        )

        const result = await graphQLClientRequestWithRetry(request, QUERY, {}, retryOnce)

        expect(counter.calls).toBe(1)
        expect(result.errors?.[0]?.code).toBe('BAD_USER_INPUT')
    })

    it('does not retry a GraphQL error even when a gateway status came with it', async () => {
        const { counter, request } = countingFailure(
            clientError(503, [{ message: 'slow down', extensions: { code: 'TOO_MANY_REQUESTS' } }])
        )

        await graphQLClientRequestWithRetry(request, QUERY, {}, retryOnce)

        expect(counter.calls).toBe(1)
    })

    it.each([400, 401, 403, 404, 429, 500])('does not retry HTTP %i', async status => {
        const { counter, request } = countingFailure(clientError(status))

        const result = await graphQLClientRequestWithRetry(request, QUERY, {}, retryOnce)

        expect(counter.calls).toBe(1)
        expect(result.errors?.[0]?.code).toBe('NETWORK')
    })

    it.each([502, 503, 504])('retries HTTP %i', async status => {
        const { counter, request } = countingFailure(clientError(status))

        await graphQLClientRequestWithRetry(request, QUERY, {}, retryOnce)

        expect(counter.calls).toBe(2)
    })
})

describe('graphQLClientRequestWithRetry: logging', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('logs the operation name and the error code, not the request variables', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { request } = countingFailure(clientError(500))

        const result = await graphQLClientRequestWithRetry(request, QUERY, {}, { skipAuth: true })

        expect(consoleError).toHaveBeenCalledTimes(1)
        const logged = consoleError.mock.calls.flat().join(' ')
        expect(logged).toBe('GraphQL request FacilitiesAndCount failed: NETWORK')
        expect(logged).not.toContain('example.com')
        expect(JSON.stringify(result.errors)).not.toContain('example.com')
    })
})
