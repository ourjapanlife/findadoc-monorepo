/** Stored moderation filters. A key that leaves this map is removed on the next read. */
export const PERSISTENT_FILTER_STORAGE_PREFIX = 'moderation-filters:'

export const persistentFilterKeys = {
    submissions: ['tab', 'pageSize', 'offset'],
    facilities: ['search', 'pageSize', 'offset'],
    professionals: ['search', 'licenseReview', 'pageSize', 'offset']
} as const

export type FilterScope = keyof typeof persistentFilterKeys
export type FilterKeyFor<Scope extends FilterScope> = (typeof persistentFilterKeys)[Scope][number]

type FilterStorage = Pick<Storage, 'key' | 'length' | 'removeItem'>

export function persistentFilterStorageKey<Scope extends FilterScope>(
    scope: Scope,
    key: FilterKeyFor<Scope>
): string {
    return `${PERSISTENT_FILTER_STORAGE_PREFIX}${scope}:${key}`
}

function browserStorage(storage: FilterStorage | undefined): FilterStorage | undefined {
    return storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
}

function knownPersistentFilterKeys(): ReadonlySet<string> {
    const keys = new Set<string>()
    const scopes = Object.keys(persistentFilterKeys) as FilterScope[]
    for (const scope of scopes) {
        for (const key of persistentFilterKeys[scope]) {
            keys.add(`${PERSISTENT_FILTER_STORAGE_PREFIX}${scope}:${key}`)
        }
    }
    return keys
}

/** Drops stored filters whose scope or key is no longer registered. */
export function sweepStaleFilters(storage?: FilterStorage): void {
    const target = browserStorage(storage)
    if (target === undefined) {
        return
    }
    try {
        const known = knownPersistentFilterKeys()
        const stale: string[] = []
        for (let index = 0; index < target.length; index += 1) {
            const key = target.key(index)
            if (key !== null && key.startsWith(PERSISTENT_FILTER_STORAGE_PREFIX) && !known.has(key)) {
                stale.push(key)
            }
        }
        for (const key of stale) {
            target.removeItem(key)
        }
    } catch {
        // Private mode can reject storage. Filters stay in memory for this visit.
    }
}
