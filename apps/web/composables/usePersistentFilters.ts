import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import {
    persistentFilterStorageKey,
    sweepStaleFilters,
    type FilterKeyFor,
    type FilterScope
} from '~/composables/persistentFiltersRegistry'
import { stableStringify } from '~/utils/stableStringify'

function storedValueFits<T>(value: unknown, defaultValue: T): value is T {
    if (Array.isArray(defaultValue)) {
        return Array.isArray(value)
    }
    if (typeof defaultValue === 'number') {
        return typeof value === 'number' && Number.isFinite(value)
    }
    if (defaultValue === null) {
        return value === null
          || typeof value === 'string'
          || typeof value === 'number'
          || typeof value === 'boolean'
    }
    return typeof value === typeof defaultValue
}

function readStored<T>(key: string, defaultValue: T): T {
    try {
        if (typeof localStorage === 'undefined') {
            return defaultValue
        }
        const raw = localStorage.getItem(key)
        if (raw === null || raw === '') {
            return defaultValue
        }
        const parsed: unknown = JSON.parse(raw)
        return storedValueFits(parsed, defaultValue) ? parsed : defaultValue
    } catch {
        return defaultValue
    }
}

function writeStored(key: string, value: unknown): void {
    try {
        if (typeof localStorage === 'undefined') {
            return
        }
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Private mode can reject storage. The filter still applies for this visit.
    }
}

/**
 * Remembers one moderation list filter across a reload.
 * A scalar outside `allowedValues` returns to the default. An array keeps the values still allowed.
 * Pass `undefined` allowed values while options are loading so nothing is dropped early.
 */
export function usePersistentFilters<T, Scope extends FilterScope>(
    scope: Scope,
    key: FilterKeyFor<Scope>,
    defaultValue: T,
    allowedValues?: MaybeRefOrGetter<readonly unknown[] | undefined>
): Ref<T> {
    sweepStaleFilters()
    const storageKey = persistentFilterStorageKey(scope, key)
    const stored = ref(readStored(storageKey, defaultValue)) as Ref<T>

    watch(stored, value => {
        writeStored(storageKey, value)
    }, { flush: 'sync' })

    if (allowedValues !== undefined) {
        watch(
            () => toValue(allowedValues),
            allowed => {
                if (allowed === undefined) {
                    return
                }
                const allowedSet = new Set(allowed.map(value => stableStringify(value)))
                if (Array.isArray(defaultValue)) {
                    const source = stored.value as unknown[]
                    const pruned = source.filter(value => allowedSet.has(stableStringify(value)))
                    if (pruned.length !== source.length) {
                        stored.value = pruned as T
                    }
                    return
                }
                const current = stored.value
                if (current === null || current === undefined) {
                    return
                }
                if (!allowedSet.has(stableStringify(current))) {
                    stored.value = defaultValue
                }
            },
            { immediate: true }
        )
    }

    return stored
}
