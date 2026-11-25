import { useState } from '#imports'
import {
    forgetRememberedSearch,
    readRememberedSearch,
    rememberedFill,
    writeRememberedSearch,
    type RememberedSearch
} from '~/utils/rememberedSearch'
import type { SearchFilters } from '~/utils/searchDirectory'

/**
 * The search language and area remembered on this device, and whether there is one to show
 * the "Forget" line for. Client only: the server and the prerender never see the storage.
 */
export function useRememberedSearch() {
    const isRemembered = useState('remembered-search', () => false)

    function restore(): RememberedSearch | undefined {
        const remembered = readRememberedSearch()
        isRemembered.value = remembered !== undefined
        return remembered
    }

    function remember(filters: SearchFilters): void {
        isRemembered.value = writeRememberedSearch(filters)
    }

    /** Keeps the remembered part these filters leave blank, so a partial search does not erase it. */
    function rememberOver(filters: SearchFilters): void {
        remember({ ...filters, ...rememberedFill(filters, readRememberedSearch()) })
    }

    function forget(): void {
        forgetRememberedSearch()
        isRemembered.value = false
    }

    return { isRemembered, restore, remember, rememberOver, forget }
}
