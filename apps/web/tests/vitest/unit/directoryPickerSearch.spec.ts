import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDirectoryPickerSearch } from '~/composables/useDirectoryPickerSearch'

describe('useDirectoryPickerSearch', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('drops a result that arrives after the picker is cleared', async () => {
        vi.useFakeTimers()
        let resolveSearch: (rows: { id: string }[]) => void = () => {}
        const scope = effectScope()
        const search = scope.run(() => useDirectoryPickerSearch<{ id: string }>(
            () => new Promise(resolve => {
                resolveSearch = resolve
            })
        ))
        if (search === undefined) {
            throw new Error('picker search did not start')
        }
        const items = ref<{ id: string }[]>([{ id: 'kept' }])

        search(items, 'aya')
        await vi.advanceTimersByTimeAsync(300)
        search.cancel()
        resolveSearch([{ id: 'late' }])
        await Promise.resolve()

        expect(items.value).toEqual([{ id: 'kept' }])
        scope.stop()
    })

    it('does not apply a result after the field is cleared', async () => {
        vi.useFakeTimers()
        const scope = effectScope()
        const search = scope.run(() => useDirectoryPickerSearch<{ id: string }>(
            async () => [{ id: 'should-not-apply' }]
        ))
        if (search === undefined) {
            throw new Error('picker search did not start')
        }
        const items = ref<{ id: string }[]>([])

        search(items, 'aya')
        search(items, '')
        await vi.advanceTimersByTimeAsync(300)

        expect(items.value).toEqual([])
        scope.stop()
    })

    it('is pending from the keystroke until the reply lands, so the menu does not say "no match"', async () => {
        vi.useFakeTimers()
        let resolveSearch: (rows: { id: string }[]) => void = () => {}
        const scope = effectScope()
        const search = scope.run(() => useDirectoryPickerSearch<{ id: string }>(
            () => new Promise(resolve => {
                resolveSearch = resolve
            })
        ))
        if (search === undefined) {
            throw new Error('picker search did not start')
        }
        const items = ref<{ id: string }[]>([])

        search(items, 'aya')
        expect(search.pending.value).toBe(true)
        await vi.advanceTimersByTimeAsync(300)
        expect(search.pending.value).toBe(true)
        resolveSearch([{ id: 'found' }])
        await vi.advanceTimersByTimeAsync(0)

        expect(items.value).toEqual([{ id: 'found' }])
        expect(search.pending.value).toBe(false)
        scope.stop()
    })

    it('is not pending once the field is cleared', () => {
        vi.useFakeTimers()
        const scope = effectScope()
        const search = scope.run(() => useDirectoryPickerSearch<{ id: string }>(async () => []))
        if (search === undefined) {
            throw new Error('picker search did not start')
        }
        const items = ref<{ id: string }[]>([])

        search(items, 'aya')
        search(items, '')

        expect(search.pending.value).toBe(false)
        scope.stop()
    })
})
