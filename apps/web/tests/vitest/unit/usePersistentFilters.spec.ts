import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
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
        const search = scope.run(() => usePersistentFilters('facilities', 'search', ''))!
        expect(search.value).toBe('')

        search.value = 'minato'
        await nextTick()

        expect(localStorage.getItem(persistentFilterStorageKey('facilities', 'search'))).toBe('"minato"')
        scope.stop()
    })

    it('restores a stored filter on the next visit', () => {
        localStorage.setItem(persistentFilterStorageKey('submissions', 'tab'), '"APPROVED"')
        const scope = effectScope()
        const tab = scope.run(() => usePersistentFilters(
            'submissions',
            'tab',
            'NEW',
            ['NEW', 'FOR_REVIEW', 'APPROVED', 'REJECTED']
        ))!
        expect(tab.value).toBe('APPROVED')
        scope.stop()
    })

    it('resets a scalar that is no longer allowed', async () => {
        localStorage.setItem(persistentFilterStorageKey('professionals', 'licenseReview'), '"CONFIRMED"')
        const scope = effectScope()
        const licenseReview = scope.run(() => usePersistentFilters(
            'professionals',
            'licenseReview',
            null,
            ['NEEDS_REVIEW']
        ))!
        await nextTick()
        expect(licenseReview.value).toBeNull()
        expect(localStorage.getItem(persistentFilterStorageKey('professionals', 'licenseReview'))).toBe('null')
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
        localStorage.setItem(
            persistentFilterStorageKey('facilities', 'search'),
            JSON.stringify(['minato', 'retired'])
        )
        const scope = effectScope()
        const search = scope.run(() => usePersistentFilters(
            'facilities',
            'search',
            [] as string[],
            ['minato']
        ))!
        await nextTick()
        expect(search.value).toEqual(['minato'])
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
        scope.run(() => usePersistentFilters('facilities', 'search', ''))
        expect(localStorage.getItem(`${PERSISTENT_FILTER_STORAGE_PREFIX}facilities:sort`)).toBeNull()
        expect(localStorage.getItem('moderation-sidebar-collapsed')).toBe('true')
        localStorage.removeItem('moderation-sidebar-collapsed')
        scope.stop()
    })

    it('keeps the in-memory value when storage rejects the write', () => {
        const scope = effectScope()
        const search = scope.run(() => usePersistentFilters('facilities', 'search', ''))!
        const setItem = localStorage.setItem.bind(localStorage)
        localStorage.setItem = () => {
            throw new Error('blocked')
        }
        try {
            search.value = 'minato'
            expect(search.value).toBe('minato')
        } finally {
            localStorage.setItem = setItem
            scope.stop()
        }
    })
})
