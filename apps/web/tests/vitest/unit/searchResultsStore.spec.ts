import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useSearchResultsStore } from '~/stores/searchResultsStore'

describe('searchResultsStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('goes back to the first page when a filter changes', async () => {
        const store = useSearchResultsStore()
        store.currentPage = 3

        store.selectedRegion = 'KANTO'
        await nextTick()

        expect(store.currentPage).toBe(1)
    })

    it('keeps a page set after a filter in the same tick, as a link restores it', async () => {
        const store = useSearchResultsStore()

        store.selectedRegion = 'KANTO'
        store.currentPage = 2
        await nextTick()

        expect(store.currentPage).toBe(2)
    })
})
