import { describe, expect, it } from 'vitest'
import { usePendingAction } from '~/composables/usePendingAction'

function deferred() {
    let resolve: () => void = () => {}
    let reject: (error: Error) => void = () => {}
    const promise = new Promise<void>((done, fail) => {
        resolve = done
        reject = fail
    })
    return { promise, resolve, reject }
}

describe('usePendingAction', () => {
    it('is pending for the pressed button until its request finishes', async () => {
        const { pending, isPending, run } = usePendingAction()
        const request = deferred()

        const running = run('save', () => request.promise)
        expect(pending.value).toBe(true)
        expect(isPending('save')).toBe(true)
        expect(isPending('delete')).toBe(false)

        request.resolve()
        await running
        expect(pending.value).toBe(false)
        expect(isPending('save')).toBe(false)
    })

    it('ignores a second press while a request is in flight', async () => {
        const { run } = usePendingAction()
        const request = deferred()
        let calls = 0

        const first = run('save', () => {
            calls += 1
            return request.promise
        })
        const second = await run('save', () => {
            calls += 1
            return Promise.resolve()
        })

        expect(second).toBeUndefined()
        expect(calls).toBe(1)
        request.resolve()
        await first
    })

    it('clears the pending state when the request fails', async () => {
        const { pending, run } = usePendingAction()

        await expect(run('save', () => Promise.reject(new Error('failed')))).rejects.toThrow('failed')
        expect(pending.value).toBe(false)
    })

    it('returns the request result', async () => {
        const { run } = usePendingAction()

        await expect(run('save', () => Promise.resolve(3))).resolves.toBe(3)
    })
})
