import { describe, expect, it, vi } from 'vitest'
import { createLookupCache } from '../src/lookupCache.js'
import { ErrorCode, type Result } from '../src/result.js'

const ok = (data: string[]): Result<string[]> => ({ data, hasErrors: false })
const failed: Result<string[]> = {
    data: [],
    hasErrors: true,
    errors: [{ field: 'cities', errorCode: ErrorCode.SERVER_ERROR, httpStatus: 500 }]
}

describe('lookup cache (#242)', () => {
    it('answers a second call from memory', async () => {
        const cache = createLookupCache<string[]>(1000, () => 0)
        const load = vi.fn(() => Promise.resolve(ok(['Minato'])))

        await cache.get('tokyo', load)
        const second = await cache.get('tokyo', load)

        expect(second.data).toEqual(['Minato'])
        expect(load).toHaveBeenCalledTimes(1)
    })

    it('keeps one entry per key', async () => {
        const cache = createLookupCache<string[]>(1000, () => 0)

        await cache.get('tokyo', () => Promise.resolve(ok(['Minato'])))
        const osaka = await cache.get('osaka', () => Promise.resolve(ok(['Osaka'])))

        expect(osaka.data).toEqual(['Osaka'])
    })

    it('asks the database again once the entry expires', async () => {
        let clock = 0
        const cache = createLookupCache<string[]>(1000, () => clock)
        const load = vi.fn(() => Promise.resolve(ok(['Minato'])))

        await cache.get('tokyo', load)
        clock = 1001
        await cache.get('tokyo', load)

        expect(load).toHaveBeenCalledTimes(2)
    })

    it('never keeps a failure', async () => {
        const cache = createLookupCache<string[]>(1000, () => 0)
        const load = vi.fn()
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(ok(['Minato']))

        expect((await cache.get('tokyo', load)).hasErrors).toBe(true)
        expect((await cache.get('tokyo', load)).data).toEqual(['Minato'])
        expect(load).toHaveBeenCalledTimes(2)
    })
})
