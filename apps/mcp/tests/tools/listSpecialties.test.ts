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

const VOCABULARY = {
    specialties: [
        { code: 'DENTISTRY', nameEn: 'Dentist', nameJa: '歯科', categories: ['DENTAL'] },
        { code: 'PSYCHIATRY', nameEn: 'Psychiatrist', nameJa: '精神科・心療内科', categories: ['MENTAL_HEALTH'] },
        { code: 'PHARMACY', nameEn: 'Pharmacist', nameJa: '薬剤師', categories: [] }
    ],
    specialtyCategories: [
        { code: 'DENTAL', nameEn: 'Dental', nameJa: '歯科', specialties: ['DENTISTRY'] },
        { code: 'MENTAL_HEALTH', nameEn: 'Mental Health', nameJa: 'メンタルヘルス', specialties: ['PSYCHIATRY'] }
    ]
}

function parsed(result: Awaited<ReturnType<Client['callTool']>>) {
    return JSON.parse((result.content as Array<{ text: string }>)[0].text)
}

describe('list_specialties', () => {
    let client: Client

    beforeEach(async () => {
        vi.clearAllMocks()

        const server = createServer()
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

        await server.connect(serverTransport)

        client = new Client({ name: 'test-client', version: '1.0.0' })
        await client.connect(clientTransport)
    })

    it('returns specialties with labels and every category, without introspection', async () => {
        mockRequest.mockResolvedValueOnce(VOCABULARY)

        const data = parsed(await client.callTool({ name: 'list_specialties', arguments: {} }))

        expect(data.count).toBe(3)
        expect(data.specialties[1]).toEqual(VOCABULARY.specialties[1])
        expect(data.categories).toEqual(VOCABULARY.specialtyCategories)
        expect(String(mockRequest.mock.calls[0][0])).not.toContain('__type')
    })

    it('returns only one category and its specialties when asked', async () => {
        mockRequest.mockResolvedValueOnce(VOCABULARY)

        const data = parsed(await client.callTool({ name: 'list_specialties', arguments: { category: 'MENTAL_HEALTH' } }))

        expect(data.count).toBe(1)
        expect(data.specialties.map((specialty: { code: string }) => specialty.code)).toEqual(['PSYCHIATRY'])
        expect(data.categories.map((category: { code: string }) => category.code)).toEqual(['MENTAL_HEALTH'])
    })

    it('refuses a category that does not exist', async () => {
        const result = await client.callTool({ name: 'list_specialties', arguments: { category: 'NOT_A_CATEGORY' } })

        expect(result.isError).toBe(true)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('should return an error when the GraphQL request fails', async () => {
        mockRequest.mockRejectedValueOnce(new Error('Connection refused'))

        const result = await client.callTool({ name: 'list_specialties', arguments: {} })

        expect(result.isError).toBe(true)
        expect((result.content as Array<{ text: string }>)[0].text).toContain('Connection refused')
    })
})
