import type { RateLimitPluginOptions } from '@fastify/rate-limit'
import { clientIpFrom } from '@findadoc/utils'

/** Requests one address may make per minute before the API answers 429. */
export const API_RATE_LIMIT_PER_MINUTE = 100

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * True when a request skips the global rate limit. Only a local API skips it, and only for
 * this machine: Playwright drives every browser through 127.0.0.1, so one shared budget made
 * signed-in specs fail with 429s. A deployed API runs with NODE_ENV=production and limits every
 * address, loopback included. The booking budgets in booking/rateLimits.ts still apply.
 */
export function skipsApiRateLimit(clientIp: string, options: { isProduction: boolean }): boolean {
    if (options.isProduction) {
        return false
    }

    return LOOPBACK_ADDRESSES.has(clientIp.trim().toLowerCase())
}

/** The global @fastify/rate-limit options: one budget per person, not per CloudFront edge (see clientIp.ts). */
export function apiRateLimitOptions(options: {
    edgeSecret: string | undefined
    isProduction: boolean
}): RateLimitPluginOptions {
    return {
        max: API_RATE_LIMIT_PER_MINUTE,
        timeWindow: '1 minute',
        keyGenerator: request => clientIpFrom(request, options.edgeSecret),
        allowList: (_request, key) => skipsApiRateLimit(key, { isProduction: options.isProduction })
    }
}
