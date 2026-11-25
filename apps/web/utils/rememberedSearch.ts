import { SEARCHABLE_LANGUAGES } from '~/utils/homeDirectory'
import { isJapanRegion, regionOfPrefecture } from '~/utils/japanRegions'
import { buildSearchQuery, parseSearchQuery, type SearchFilters } from '~/utils/searchDirectory'

/**
 * The visitor's last search language and area, kept in their own browser so the next search
 * starts there. Only these two choices are kept: a specialty can say something about a
 * visitor's health, so it is never stored, and neither is anything typed. Nothing here is
 * sent to the API or to analytics. The privacy policy already says recent filters are saved
 * in the browser.
 */
export const REMEMBERED_SEARCH_STORAGE_KEY = 'search.remembered'

/** A choice not picked again for this long is dropped on the next read. */
export const REMEMBERED_SEARCH_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

const REMEMBERED_SEARCH_VERSION = 1
const STORED_QUERY_KEYS = ['language', 'region', 'prefecture', 'city'] as const
const CITY_SLUG = /^[a-z0-9-]{1,64}$/

export type RememberedSearch = Pick<SearchFilters, 'languages' | 'region' | 'prefecture' | 'city'>

type RememberedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface StoredRememberedSearch {
    v: typeof REMEMBERED_SEARCH_VERSION
    savedAt: number
    query: Record<string, string>
}

function browserStorage(storage: RememberedStorage | undefined): RememberedStorage | undefined {
    if (storage !== undefined) {
        return storage
    }
    try {
        return typeof localStorage === 'undefined' ? undefined : localStorage
    } catch {
        // A sandboxed frame can throw on the property itself.
        return undefined
    }
}

/**
 * Keeps only a language the search offers and a place the search knows. A city needs its
 * prefecture, and a region that contradicts the prefecture is dropped.
 */
function sanitize(filters: RememberedSearch): RememberedSearch {
    const language = filters.languages?.[0]
    const prefecture = regionOfPrefecture(filters.prefecture) === undefined ? undefined : filters.prefecture
    const region = isJapanRegion(filters.region) ? filters.region : undefined
    const city = prefecture !== undefined && filters.city !== undefined && CITY_SLUG.test(filters.city)
        ? filters.city
        : undefined

    return {
        languages: language !== undefined && SEARCHABLE_LANGUAGES.includes(language) ? [language] : undefined,
        region: prefecture === undefined ? region : regionOfPrefecture(prefecture),
        prefecture,
        city
    }
}

function hasLanguage(filters: RememberedSearch): boolean {
    return (filters.languages?.length ?? 0) > 0
}

function hasArea(filters: RememberedSearch): boolean {
    return filters.region !== undefined || filters.prefecture !== undefined || filters.city !== undefined
}

function isEmpty(filters: RememberedSearch): boolean {
    return !hasLanguage(filters) && !hasArea(filters)
}

function parseStored(raw: string): StoredRememberedSearch | undefined {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
        return undefined
    }
    const { v, savedAt, query } = parsed as Record<string, unknown>
    if (v !== REMEMBERED_SEARCH_VERSION || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
        return undefined
    }
    if (typeof query !== 'object' || query === null) {
        return undefined
    }
    const cleanQuery: Record<string, string> = {}
    for (const key of STORED_QUERY_KEYS) {
        const value = (query as Record<string, unknown>)[key]
        if (typeof value === 'string' && value !== '') {
            cleanQuery[key] = value
        }
    }
    return { v, savedAt, query: cleanQuery }
}

/**
 * The remembered language and area, or undefined. A value that is old, from the future,
 * malformed, or no longer a search option is removed rather than returned.
 */
export function readRememberedSearch(
    storage?: RememberedStorage,
    now: number = Date.now()
): RememberedSearch | undefined {
    const target = browserStorage(storage)
    if (target === undefined) {
        return undefined
    }
    try {
        const raw = target.getItem(REMEMBERED_SEARCH_STORAGE_KEY)
        if (raw === null || raw === '') {
            return undefined
        }
        const stored = parseStored(raw)
        const age = stored === undefined ? -1 : now - stored.savedAt
        if (stored === undefined || age < 0 || age > REMEMBERED_SEARCH_MAX_AGE_MS) {
            target.removeItem(REMEMBERED_SEARCH_STORAGE_KEY)
            return undefined
        }
        const remembered = sanitize(parseSearchQuery(stored.query))
        if (isEmpty(remembered)) {
            target.removeItem(REMEMBERED_SEARCH_STORAGE_KEY)
            return undefined
        }
        return remembered
    } catch {
        // Private mode can reject storage, and a hand-edited value may not parse.
        return undefined
    }
}

/**
 * Stores the language and area from these filters and nothing else. Filters with neither
 * remove the entry. Returns whether something is remembered afterwards.
 */
export function writeRememberedSearch(
    filters: SearchFilters,
    storage?: RememberedStorage,
    now: number = Date.now()
): boolean {
    const target = browserStorage(storage)
    if (target === undefined) {
        return false
    }
    const remembered = sanitize(filters)
    try {
        if (isEmpty(remembered)) {
            target.removeItem(REMEMBERED_SEARCH_STORAGE_KEY)
            return false
        }
        const stored: StoredRememberedSearch = {
            v: REMEMBERED_SEARCH_VERSION,
            savedAt: now,
            query: buildSearchQuery(remembered)
        }
        target.setItem(REMEMBERED_SEARCH_STORAGE_KEY, JSON.stringify(stored))
        return true
    } catch {
        // Storage can be full or refused. The search still works for this visit.
        return false
    }
}

export function forgetRememberedSearch(storage?: RememberedStorage): void {
    const target = browserStorage(storage)
    if (target === undefined) {
        return
    }
    try {
        target.removeItem(REMEMBERED_SEARCH_STORAGE_KEY)
    } catch {
        // Nothing to do: storage that refuses a removal held nothing we could read either.
    }
}

/**
 * The remembered values for what these filters leave blank, or undefined when nothing fills.
 * The language and the area are filled separately, and the area as a whole: a link that names
 * a prefecture keeps it, and never gains a remembered city from somewhere else.
 */
export function rememberedFill(
    filters: SearchFilters,
    remembered: RememberedSearch | undefined
): RememberedSearch | undefined {
    if (remembered === undefined) {
        return undefined
    }
    const fill: RememberedSearch = {}
    if (!hasLanguage(filters) && hasLanguage(remembered)) {
        fill.languages = remembered.languages
    }
    if (!hasArea(filters) && hasArea(remembered)) {
        fill.region = remembered.region
        fill.prefecture = remembered.prefecture
        fill.city = remembered.city
    }
    return isEmpty(fill) ? undefined : fill
}
