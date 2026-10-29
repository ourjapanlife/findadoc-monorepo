import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('booking rate limits', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it.each([
        ['upload', 20, 60 * 60 * 1000],
        ['submit', 10, 60 * 60 * 1000],
        ['token', 30, 10 * 60 * 1000]
    ] as const)('enforces the %s limit per address and window', async (budget, limit, windowMs) => {
        const { allowBookingCall } = await import('../src/booking/rateLimits.js')
        const start = Date.parse('2026-10-29T00:00:00Z')
        for (let index = 0; index < limit; index++) {
            expect(allowBookingCall(budget, 'same-ip', start)).toBe(true)
        }
        expect(allowBookingCall(budget, 'same-ip', start)).toBe(false)
        expect(allowBookingCall(budget, 'other-ip', start)).toBe(true)
        expect(allowBookingCall(budget, 'same-ip', start + windowMs - 1)).toBe(false)
        expect(allowBookingCall(budget, 'same-ip', start + windowMs)).toBe(true)
    })

    it('keeps each budget separate', async () => {
        const { allowBookingCall } = await import('../src/booking/rateLimits.js')
        const now = Date.parse('2026-10-29T00:00:00Z')
        for (let index = 0; index < 10; index++) {
            expect(allowBookingCall('submit', 'same-ip', now)).toBe(true)
        }
        expect(allowBookingCall('submit', 'same-ip', now)).toBe(false)
        expect(allowBookingCall('upload', 'same-ip', now)).toBe(true)
        expect(allowBookingCall('token', 'same-ip', now)).toBe(true)
    })

    it('does not count a refused call', async () => {
        const { allowBookingCall } = await import('../src/booking/rateLimits.js')
        const start = Date.parse('2026-10-29T00:00:00Z')
        for (let index = 0; index < 10; index++) {
            expect(allowBookingCall('submit', 'same-ip', start)).toBe(true)
        }
        // Retrying near the end of the window does not push the wait out.
        expect(allowBookingCall('submit', 'same-ip', start + 59 * 60 * 1000)).toBe(false)
        expect(allowBookingCall('submit', 'same-ip', start + 60 * 60 * 1000)).toBe(true)
    })
})
