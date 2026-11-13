import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/graphql.js', () => ({
    gqlClient: {
        request: vi.fn()
    }
}))

import { gqlClient } from '../src/graphql.js'
import { registerRestRoutes } from '../src/rest.js'

const mockRequest = vi.mocked(gqlClient.request)

// request() is overloaded, so the mock types each call as the one-argument form. The variables are the second.
function variablesOf(call: number): unknown {
    return (mockRequest.mock.calls[call] as unknown[])[1]
}

describe('REST routes', () => {
    let app: FastifyInstance

    beforeEach(async () => {
        vi.clearAllMocks()
        app = Fastify()
        await registerRestRoutes(app)
    })

    it('GET /api/healthcare-professionals returns results and forwards array filters', async () => {
        mockRequest.mockResolvedValueOnce({
            healthcareProfessionals: [{ id: 'hp-1' }],
            healthcareProfessionalsTotalCount: 1
        })

        const res = await app.inject({
            method: 'GET',
            url: '/api/healthcare-professionals?limit=5&spokenLanguages=en_US&specialties=DENTISTRY,PEDIATRICS'
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().totalCount).toBe(1)
        expect(mockRequest).toHaveBeenCalledWith(expect.anything(), {
            filters: { limit: 5, offset: 0, spokenLanguages: ['en_US'], specialties: ['DENTISTRY', 'PEDIATRICS'] }
        })
    })

    it('GET /api/facilities/:id returns 404 when not found', async () => {
        mockRequest.mockResolvedValueOnce({ facility: null })

        const res = await app.inject({ method: 'GET', url: '/api/facilities/missing' })

        expect(res.statusCode).toBe(404)
        expect(res.json().error).toContain('No facility found')
    })

    it('GET /api/facilities/:id returns the facility when found', async () => {
        mockRequest.mockResolvedValueOnce({ facility: { id: 'f-1', nameEn: 'A-ONE Dental Clinic' } })

        const res = await app.inject({ method: 'GET', url: '/api/facilities/f-1' })

        expect(res.statusCode).toBe(200)
        expect(res.json().nameEn).toBe('A-ONE Dental Clinic')
    })

    it('GET /api/specialties returns specialties and categories with labels', async () => {
        const dentistry = { code: 'DENTISTRY', nameEn: 'Dentist', nameJa: '歯科', categories: ['DENTAL'] }
        const dental = { code: 'DENTAL', nameEn: 'Dental', nameJa: '歯科', specialties: ['DENTISTRY'] }

        mockRequest.mockResolvedValueOnce({ specialties: [dentistry], specialtyCategories: [dental] })

        const res = await app.inject({ method: 'GET', url: '/api/specialties' })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual({ count: 1, specialties: [dentistry], categories: [dental] })
    })

    it('GET /api/specialties filters by category', async () => {
        mockRequest.mockResolvedValueOnce({
            specialties: [
                { code: 'DENTISTRY', nameEn: 'Dentist', nameJa: '歯科', categories: ['DENTAL'] },
                { code: 'PSYCHIATRY', nameEn: 'Psychiatrist', nameJa: '精神科・心療内科', categories: ['MENTAL_HEALTH'] }
            ],
            specialtyCategories: [
                { code: 'DENTAL', nameEn: 'Dental', nameJa: '歯科', specialties: ['DENTISTRY'] },
                { code: 'MENTAL_HEALTH', nameEn: 'Mental Health', nameJa: 'メンタルヘルス', specialties: ['PSYCHIATRY'] }
            ]
        })

        const res = await app.inject({ method: 'GET', url: '/api/specialties?category=MENTAL_HEALTH' })

        expect(res.statusCode).toBe(200)
        expect(res.json().specialties.map((specialty: { code: string }) => specialty.code)).toEqual(['PSYCHIATRY'])
        expect(res.json().categories.map((category: { code: string }) => category.code)).toEqual(['MENTAL_HEALTH'])
    })

    it('GET /api/specialties refuses an unknown category without calling the API', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/specialties?category=NOPE' })

        expect(res.statusCode).toBe(400)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('GET /api/languages asks for published languages unless includeUnpublished is true', async () => {
        mockRequest.mockResolvedValue({ languages: [] })

        expect((await app.inject({ method: 'GET', url: '/api/languages' })).statusCode).toBe(200)
        expect(variablesOf(0)).toEqual({ publishedOnly: true })

        await app.inject({ method: 'GET', url: '/api/languages?includeUnpublished=true' })
        expect(variablesOf(1)).toEqual({ publishedOnly: false })
    })

    it('GET /api/languages refuses an includeUnpublished that is not true or false', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/languages?includeUnpublished=yes' })

        expect(res.statusCode).toBe(400)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('returns 502 when the upstream GraphQL call fails', async () => {
        mockRequest.mockRejectedValueOnce(new Error('Connection refused'))

        const res = await app.inject({ method: 'GET', url: '/api/languages' })

        expect(res.statusCode).toBe(502)
        expect(res.json().error).toContain('Connection refused')
    })

    it('serves the OpenAPI manifest', async () => {
        const res = await app.inject({ method: 'GET', url: '/openapi.yaml' })

        expect(res.statusCode).toBe(200)
        expect(res.headers['content-type']).toContain('yaml')
        expect(res.body).toContain('openapi: 3.1.0')
    })
})
