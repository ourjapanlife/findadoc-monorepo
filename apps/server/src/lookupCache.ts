import type { Result } from './result.js'

/**
 * How long a Lambda container keeps a lookup table (#242). Prefectures and cities change only
 * through a migration or a backfill, so a container may answer from memory this long.
 */
export const LOOKUP_TTL_MS = 10 * 60 * 1000

interface Entry<T> {
    result: Result<T>
    expiresAt: number
}

export interface LookupCache<T> {
    get(key: string, load: () => Promise<Result<T>>): Promise<Result<T>>
    clear(): void
}

/**
 * Keeps successful results in module memory, one per key, for `ttlMs`. A failed result is
 * never kept, so the next call asks the database again.
 */
export function createLookupCache<T>(ttlMs: number = LOOKUP_TTL_MS, now: () => number = Date.now): LookupCache<T> {
    const entries = new Map<string, Entry<T>>()

    return {
        async get(key, load) {
            const cached = entries.get(key)
            if (cached && cached.expiresAt > now()) {
                return cached.result
            }

            const result = await load()
            if (result.hasErrors) {
                entries.delete(key)
            } else {
                entries.set(key, { result, expiresAt: now() + ttlMs })
            }
            return result
        },
        clear() {
            entries.clear()
        }
    }
}
