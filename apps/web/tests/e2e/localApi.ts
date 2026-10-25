import { expect, test } from '@playwright/test'

/**
 * A refused connection means this machine is not running the local API.
 * CI always starts that API, so the same failure is a broken database run.
 */
export function skipIfLocalApiIsDown(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    const down = /ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed|socket hang up/i.test(message)

    if (down && !process.env.CI) {
        test.skip(true, 'local API is not running')
        return
    }

    throw error
}

export function assertLocalApiOk(json: { errors?: unknown[] | null }): void {
    if (json.errors?.length) {
        throw new Error(`local API returned errors: ${JSON.stringify(json.errors)}`)
    }
}

/** Empty seed data fails in CI. A local run without rows still skips. */
export function requireLocalRows<T>(rows: readonly T[] | undefined, emptyReason: string): T[] {
    const list = [...(rows ?? [])]

    if (list.length > 0) {
        return list
    }

    if (process.env.CI) {
        expect(list, emptyReason).not.toHaveLength(0)
    }

    test.skip(true, emptyReason)
    return list
}
