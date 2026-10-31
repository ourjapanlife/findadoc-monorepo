import { afterEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import rateLimitPlugin from '@fastify/rate-limit'
import { API_RATE_LIMIT_PER_MINUTE, apiRateLimitOptions, skipsApiRateLimit } from '../src/apiRateLimit.js'

const apps: FastifyInstance[] = []

async function buildApp(isProduction: boolean, remoteAddress?: string) {
    const app = Fastify()
    apps.push(app)
    await app.register(rateLimitPlugin, apiRateLimitOptions({ edgeSecret: undefined, isProduction }))
    app.get('/ping', async () => 'ok')
    await app.ready()

    const statuses: number[] = []
    for (let request = 0; request <= API_RATE_LIMIT_PER_MINUTE; request++) {
        const response = await app.inject({ method: 'GET', url: '/ping', remoteAddress })
        statuses.push(response.statusCode)
    }
    return statuses
}

afterEach(async () => {
    await Promise.all(apps.splice(0).map(app => app.close()))
})

describe('API rate limit', () => {
    it('lets a local API serve this machine past the limit, as Playwright needs', async () => {
        const statuses = await buildApp(false)

        expect(statuses.every(status => status === 200)).toBe(true)
    })

    it('still limits another address on a local API', async () => {
        const statuses = await buildApp(false, '203.0.113.7')

        expect(statuses.at(-1)).toBe(429)
    })

    it('limits loopback in production', async () => {
        const statuses = await buildApp(true)

        expect(statuses.slice(0, API_RATE_LIMIT_PER_MINUTE).every(status => status === 200)).toBe(true)
        expect(statuses.at(-1)).toBe(429)
    })

    it('only skips loopback addresses, and never in production', () => {
        expect(skipsApiRateLimit('127.0.0.1', { isProduction: false })).toBe(true)
        expect(skipsApiRateLimit('::1', { isProduction: false })).toBe(true)
        expect(skipsApiRateLimit('::ffff:127.0.0.1', { isProduction: false })).toBe(true)
        expect(skipsApiRateLimit('10.0.0.5', { isProduction: false })).toBe(false)
        expect(skipsApiRateLimit('unknown', { isProduction: false })).toBe(false)
        expect(skipsApiRateLimit('127.0.0.1', { isProduction: true })).toBe(false)
    })
})
