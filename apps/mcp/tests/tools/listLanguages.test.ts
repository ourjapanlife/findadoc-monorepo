import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../../src/server.js'

vi.mock('../../src/graphql.js', () => ({
    gqlClient: {
        request: vi.fn()
    }
}))

import { gqlClient } from '../../src/graphql.js'

const mockRequest = vi.mocked(gqlClient.request)

// request() is overloaded, so the mock types each call as the one-argument form. The variables are the second.
function variablesOf(call: number): unknown {
    return (mockRequest.mock.calls[call] as unknown[])[1]
}

const JAPANESE = { code: 'ja_JP', nameEn: 'Japanese', nameJa: '日本語', nameNative: '日本語', published: true }
const AKAN = { code: 'ak_GH', nameEn: 'Akan', nameJa: 'アカン語', nameNative: 'Akan', published: false }

describe('list_languages', () => {
    let client: Client

    beforeEach(async () => {
        vi.clearAllMocks()

        const server = createServer()
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

        await server.connect(serverTransport)

        client = new Client({ name: 'test-client', version: '1.0.0' })
        await client.connect(clientTransport)
    })

    it('asks for the search-facet languages only by default', async () => {
        mockRequest.mockResolvedValueOnce({ languages: [JAPANESE] })

        const result = await client.callTool({ name: 'list_languages', arguments: {} })
        const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text)

        expect(parsed).toEqual({ count: 1, languages: [JAPANESE] })
        expect(variablesOf(0)).toEqual({ publishedOnly: true })
        expect(String(mockRequest.mock.calls[0][0])).not.toContain('__type')
    })

    it('asks for every code when includeUnpublished is true', async () => {
        mockRequest.mockResolvedValueOnce({ languages: [JAPANESE, AKAN] })

        const result = await client.callTool({ name: 'list_languages', arguments: { includeUnpublished: true } })
        const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text)

        expect(parsed.count).toBe(2)
        expect(parsed.languages[1].published).toBe(false)
        expect(variablesOf(0)).toEqual({ publishedOnly: false })
    })

    it('should return an error when the GraphQL request fails', async () => {
        mockRequest.mockRejectedValueOnce(new Error('Connection refused'))

        const result = await client.callTool({ name: 'list_languages', arguments: {} })

        expect(result.isError).toBe(true)
        expect((result.content as Array<{ text: string }>)[0].text).toContain('Connection refused')
    })
})
