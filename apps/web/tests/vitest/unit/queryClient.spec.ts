import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MutationObserver } from '@tanstack/vue-query'
import { ErrorCode } from '~/typedefs/serverResponse'

const graphQLClientRequestWithRetry = vi.fn()

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

const {
    QueryRequestError,
    clearQueryCache,
    createAppQueryClient,
    queryRetryDelay,
    requestQueryData,
    shouldRetryQuery
} = await import('~/utils/queryClient')
const { queryKeys } = await import('~/utils/queryKeys')

const networkErrors = [{ message: 'Request timed out', code: ErrorCode.NETWORK, field: undefined }]
const temporaryError = () => new QueryRequestError(networkErrors, true)
const graphQLError = () => new QueryRequestError([{ message: 'no', code: ErrorCode.UNAUTHORIZED, field: undefined }], false)

describe('the query retry rule (#219, #242)', () => {
    it('retries a temporary failure once', () => {
        expect(shouldRetryQuery(0, temporaryError())).toBe(true)
        expect(shouldRetryQuery(1, temporaryError())).toBe(false)
    })

    it('does not retry a GraphQL error or an unknown failure', () => {
        expect(shouldRetryQuery(0, graphQLError())).toBe(false)
        expect(shouldRetryQuery(0, new Error('boom'))).toBe(false)
    })

    it('backs off exponentially, with a ceiling', () => {
        expect([0, 1, 2, 3, 10].map(queryRetryDelay)).toEqual([1000, 2000, 4000, 8000, 8000])
    })

    describe('through the app query client', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('sends a query twice at most when it keeps timing out', async () => {
            const queryFn = vi.fn(() => Promise.reject(temporaryError()))
            const result = createAppQueryClient().fetchQuery({ queryKey: ['retry-test'], queryFn })
            const settled = result.catch((error: unknown) => error)

            await vi.advanceTimersByTimeAsync(10000)

            expect(await settled).toBeInstanceOf(QueryRequestError)
            expect(queryFn).toHaveBeenCalledTimes(2)
        })

        it('sends a query once when the server answered with an error', async () => {
            const queryFn = vi.fn(() => Promise.reject(graphQLError()))
            const settled = createAppQueryClient().fetchQuery({ queryKey: ['retry-test'], queryFn })
                .catch((error: unknown) => error)

            await vi.advanceTimersByTimeAsync(10000)

            expect(await settled).toBeInstanceOf(QueryRequestError)
            expect(queryFn).toHaveBeenCalledTimes(1)
        })

        it('never retries a mutation, even after a timeout', async () => {
            const mutationFn = vi.fn(() => Promise.reject(temporaryError()))
            const observer = new MutationObserver(createAppQueryClient(), { mutationFn })
            const settled = observer.mutate().catch((error: unknown) => error)

            await vi.advanceTimersByTimeAsync(10000)

            expect(await settled).toBeInstanceOf(QueryRequestError)
            expect(mutationFn).toHaveBeenCalledTimes(1)
        })
    })
})

describe('requestQueryData', () => {
    beforeEach(() => {
        graphQLClientRequestWithRetry.mockReset()
    })

    it('returns the data and makes one attempt', async () => {
        graphQLClientRequestWithRetry.mockResolvedValue({ data: { x: 1 }, errors: [], hasErrors: false })

        await expect(requestQueryData('query Q { x }', {}, { skipAuth: true })).resolves.toEqual({ x: 1 })
        expect(graphQLClientRequestWithRetry.mock.calls[0]?.[3]).toMatchObject({ skipAuth: true, retryAmount: 0 })
    })

    it('passes the caller signal through', async () => {
        graphQLClientRequestWithRetry.mockResolvedValue({ data: {}, errors: [], hasErrors: false })
        const { signal } = new AbortController()

        await requestQueryData('query Q { x }', {}, { signal })

        expect(graphQLClientRequestWithRetry.mock.calls[0]?.[3]).toMatchObject({ signal })
    })

    it('throws a temporary error for a timeout, and a lasting one for a GraphQL error', async () => {
        graphQLClientRequestWithRetry.mockResolvedValueOnce({ data: {}, errors: networkErrors, hasErrors: true, temporary: true })
        graphQLClientRequestWithRetry.mockResolvedValueOnce({ data: {}, errors: networkErrors, hasErrors: true })

        await expect(requestQueryData('query Q { x }', {})).rejects.toMatchObject({ temporary: true })
        await expect(requestQueryData('query Q { x }', {})).rejects.toMatchObject({ temporary: false })
    })

    it('keeps server messages out of the error message', async () => {
        const errors = [{ message: 'email a@example.test is taken', code: ErrorCode.BAD_USER_INPUT, field: 'email' }]
        graphQLClientRequestWithRetry.mockResolvedValue({ data: {}, errors, hasErrors: true })

        const error = await requestQueryData('query Q { x }', {}).catch((caught: unknown) => caught)

        expect(error).toBeInstanceOf(QueryRequestError)
        expect((error as Error).message).toBe('Query failed: BAD_USER_INPUT')
    })
})

describe('clearQueryCache', () => {
    it('drops every cached read', async () => {
        const queryClient = createAppQueryClient()
        queryClient.setQueryData(queryKeys.searchDirectory(), { facilities: [], professionals: [] })
        queryClient.setQueryData(['moderation', 'submissions'], [{ id: 'submission-1' }])

        clearQueryCache(queryClient)

        expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    })
})

describe('queryKeys', () => {
    it('puts the search directory under the directory root, so a directory write invalidates it', () => {
        expect(queryKeys.searchDirectory().slice(0, queryKeys.directory().length)).toEqual(queryKeys.directory())
    })
})
