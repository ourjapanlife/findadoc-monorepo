import { afterEach, describe, expect, it, vi } from 'vitest'
import { gql } from 'graphql-request'
import { graphQLClientRequestWithRetry, initializeGqlClient, publicGetRequest } from '~/utils/graphql'

const QUERY = gql`
    query SearchFacilitiesPage($filters: FacilitySearchFilters!) {
        facilities(filters: $filters) {
            id
        }
    }
`

function respondWith(status: number, body: unknown) {
    const fetchMock = vi.fn((_input: URL, _init?: RequestInit) =>
        Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('publicGetRequest (#242)', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('sends the query and variables in the URL of a GET', async () => {
        initializeGqlClient()
        const fetchMock = respondWith(200, { data: { facilities: [] } })

        await publicGetRequest({ document: QUERY, variables: { filters: { limit: 100, offset: 0 } } })

        const [url, init] = fetchMock.mock.calls[0]!
        expect(init?.method).toBe('GET')
        expect(url.searchParams.get('query')).toBe(
            'query SearchFacilitiesPage($filters: FacilitySearchFilters!) { facilities(filters: $filters) { id } }'
        )
        expect(JSON.parse(url.searchParams.get('variables') ?? '')).toEqual({ filters: { limit: 100, offset: 0 } })
    })

    it('sends no token and no custom header, so the edge may cache it and no preflight runs', async () => {
        const fetchMock = respondWith(200, { data: { facilities: [] } })

        await publicGetRequest({ document: QUERY })

        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
        expect(headers.has('authorization')).toBe(false)
        expect([...headers.keys()]).toEqual(['accept'])
    })

    it('passes the abort signal to fetch', async () => {
        const fetchMock = respondWith(200, { data: { facilities: [] } })
        const { signal } = new AbortController()

        await publicGetRequest({ document: QUERY, signal })

        expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(signal)
    })

    it('keeps a GraphQL error, and does not retry it', async () => {
        const fetchMock = respondWith(200, { errors: [{ message: 'no', extensions: { code: 'BAD_USER_INPUT' } }] })

        const result = await graphQLClientRequestWithRetry(publicGetRequest, QUERY, {}, { skipAuth: true, retryAmount: 1 })

        expect(result).toMatchObject({ hasErrors: true, temporary: false, errors: [{ code: 'BAD_USER_INPUT' }] })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('treats a 503 from the edge as temporary', async () => {
        respondWith(503, { message: 'Service Unavailable' })

        const result = await graphQLClientRequestWithRetry(publicGetRequest, QUERY, {}, { skipAuth: true })

        expect(result).toMatchObject({ hasErrors: true, temporary: true })
    })
})
