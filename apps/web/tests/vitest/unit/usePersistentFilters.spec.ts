import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    PERSISTENT_FILTER_STORAGE_PREFIX,
    persistentFilterStorageKey
} from '~/composables/persistentFiltersRegistry'
import { usePersistentFilters } from '~/composables/usePersistentFilters'

function clearStoredFilters() {
    const stale: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (key !== null && key.startsWith(PERSISTENT_FILTER_STORAGE_PREFIX)) {
            stale.push(key)
        }
    }
    for (const key of stale) {
        localStorage.removeItem(key)
    }
}

describe('usePersistentFilters', () => {
    beforeEach(() => {
        clearStoredFilters()
    })

    it('starts from the default and writes the next value', async () => {
        const scope = effectScope()
        const offset = scope.run(() => usePersistentFilters('facilities', 'offset', 0))!
        expect(offset.value).toBe(0)

        offset.value = 50
        await nextTick()

        expect(localStorage.getItem(persistentFilterStorageKey('facilities', 'offset'))).toBe('50')
        scope.stop()
    })

    it('restores a stored filter on the next visit', () => {
        localStorage.setItem(persistentFilterStorageKey('submissions', 'pageSize'), '50')
        const scope = effectScope()
        const pageSize = scope.run(() => usePersistentFilters('submissions', 'pageSize', 25, [25, 50, 100]))!
        expect(pageSize.value).toBe(50)
        scope.stop()
    })

    it('resets a scalar that is no longer allowed', async () => {
        localStorage.setItem(persistentFilterStorageKey('submissions', 'pageSize'), '10')
        const scope = effectScope()
        const pageSize = scope.run(() => usePersistentFilters('submissions', 'pageSize', 25, [25, 50]))!
        await nextTick()
        expect(pageSize.value).toBe(25)
        expect(localStorage.getItem(persistentFilterStorageKey('submissions', 'pageSize'))).toBe('25')
        scope.stop()
    })

    it('drops the old submissions tab and review filters, which no longer persist (#313)', () => {
        localStorage.setItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}submissions:tab`, '"APPROVED"')
        localStorage.setItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}professionals:licenseReview`, '"NEEDS_REVIEW"')
        localStorage.setItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}professionals:nameReview`, '"NEEDS_REVIEW"')
        const scope = effectScope()
        scope.run(() => usePersistentFilters('submissions', 'offset', 0))
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}submissions:tab`)).toBeNull()
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}professionals:licenseReview`)).toBeNull()
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}professionals:nameReview`)).toBeNull()
        scope.stop()
    })

    it('leaves a stored page size alone until the allowed sizes are known', async () => {
        localStorage.setItem(persistentFilterStorageKey('professionals', 'pageSize'), '10')
        const allowed = ref<readonly number[] | undefined>(undefined)
        const scope = effectScope()
        const pageSize = scope.run(() => usePersistentFilters('professionals', 'pageSize', 25, allowed))!
        expect(pageSize.value).toBe(10)

        allowed.value = [25, 50]
        await nextTick()
        expect(pageSize.value).toBe(25)
        scope.stop()
    })

    it('prunes an array to the values that are still allowed', async () => {
        // No registered key holds a list today; offset stands in to test the array rule.
        localStorage.setItem(
            persistentFilterStorageKey('bookings', 'offset'),
            JSON.stringify(['NEW', 'RETIRED'])
        )
        const scope = effectScope()
        const tabs = scope.run(() => usePersistentFilters(
            'bookings',
            'offset',
            [] as string[],
            ['NEW']
        ))!
        await nextTick()
        expect(tabs.value).toEqual(['NEW'])
        scope.stop()
    })

    it('ignores a stored value that is not JSON', () => {
        localStorage.setItem(persistentFilterStorageKey('facilities', 'offset'), 'nope')
        const scope = effectScope()
        const offset = scope.run(() => usePersistentFilters('facilities', 'offset', 0))!
        expect(offset.value).toBe(0)
        scope.stop()
    })

    it('drops a filter key that is no longer registered', () => {
        localStorage.setItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}facilities:sort`, '"nameEn"')
        localStorage.setItem('moderation-sidebar-collapsed', 'true')
        const scope = effectScope()
        scope.run(() => usePersistentFilters('facilities', 'offset', 0))
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}facilities:sort`)).toBeNull()
        expect(localStorage.getItem('moderation-sidebar-collapsed')).toBe('true')
        localStorage.removeItem('moderation-sidebar-collapsed')
        scope.stop()
    })

    it('does not keep search text across a reload', () => {
        localStorage.setItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}facilities:search`, '"minato"')
        localStorage.setItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}professionals:search`, '"tanaka"')
        const scope = effectScope()
        scope.run(() => usePersistentFilters('professionals', 'offset', 0))
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}facilities:search`)).toBeNull()
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}professionals:search`)).toBeNull()
        scope.stop()
    })

    it('keeps the in-memory value when storage rejects the write', () => {
        const scope = effectScope()
        const offset = scope.run(() => usePersistentFilters('facilities', 'offset', 0))!
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        try {
            expect(() => {
                offset.value = 50
            }).not.toThrow()
            expect(setItem).toHaveBeenCalled()
            expect(offset.value).toBe(50)
        } finally {
            setItem.mockRestore()
            scope.stop()
        }
    })
})
