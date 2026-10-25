import { describe, expect, it } from 'vitest'
import { timestamptzToIso } from '../src/kyselyClient.js'

describe('timestamptzToIso', () => {
    it('reads Postgres timestamptz text as the ISO string the API has always returned', () => {
        expect(timestamptzToIso('2026-10-25 03:00:00.123456+00')).toBe('2026-10-25T03:00:00.123456+00:00')
        expect(timestamptzToIso('2026-01-12 09:00:00+00')).toBe('2026-01-12T09:00:00+00:00')
    })

    it('keeps an offset that already has minutes', () => {
        expect(timestamptzToIso('2026-10-25 12:00:00+05:30')).toBe('2026-10-25T12:00:00+05:30')
    })
})
