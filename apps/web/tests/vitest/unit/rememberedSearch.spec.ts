import { describe, expect, it } from 'vitest'
import { Locale, Specialty, SpecialtyCategory } from '@findadoc/graphql'
import {
    REMEMBERED_SEARCH_MAX_AGE_MS,
    REMEMBERED_SEARCH_STORAGE_KEY,
    forgetRememberedSearch,
    readRememberedSearch,
    rememberedFill,
    writeRememberedSearch
} from '~/utils/rememberedSearch'

const NOW = Date.UTC(2026, 10, 25)

function memoryStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial))
    return {
        items,
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => {
            items.set(key, value)
        },
        removeItem: (key: string) => {
            items.delete(key)
        }
    }
}

function refusingStorage() {
    return {
        getItem: (): string | null => {
            throw new Error('denied')
        },
        setItem: () => {
            throw new Error('denied')
        },
        removeItem: () => {
            throw new Error('denied')
        }
    }
}

function stored(query: Record<string, unknown>, savedAt = NOW): string {
    return JSON.stringify({ v: 1, savedAt, query })
}

describe('writeRememberedSearch', () => {
    it('keeps the language and area and never the specialty', () => {
        const storage = memoryStorage()
        const kept = writeRememberedSearch({
            languages: [Locale.FrFr],
            prefecture: 'osaka',
            city: 'sakai',
            specialtyGroup: SpecialtyCategory.MentalHealth,
            specialties: [Specialty.Psychiatry]
        }, storage, NOW)

        expect(kept).toBe(true)
        const raw = storage.items.get(REMEMBERED_SEARCH_STORAGE_KEY) ?? ''
        expect(JSON.parse(raw)).toEqual({
            v: 1,
            savedAt: NOW,
            query: { language: 'fr', region: 'kansai', prefecture: 'osaka', city: 'sakai' }
        })
        expect(raw).not.toMatch(/psychiatry|mental/i)
    })

    it('removes the entry when the filters hold neither a language nor an area', () => {
        const storage = memoryStorage({ [REMEMBERED_SEARCH_STORAGE_KEY]: stored({ language: 'fr' }) })

        expect(writeRememberedSearch({ specialties: [Specialty.Dentistry] }, storage, NOW)).toBe(false)
        expect(storage.items.has(REMEMBERED_SEARCH_STORAGE_KEY)).toBe(false)
    })

    it('does not keep a language the search does not offer', () => {
        const storage = memoryStorage()

        expect(writeRememberedSearch({ languages: [Locale.AkGh] }, storage, NOW)).toBe(false)
        expect(storage.items.size).toBe(0)
    })

    it('does not keep a city without its prefecture', () => {
        const storage = memoryStorage()

        expect(writeRememberedSearch({ city: 'sakai' }, storage, NOW)).toBe(false)
    })

    it('reports nothing kept when storage refuses the write', () => {
        expect(writeRememberedSearch({ languages: [Locale.FrFr] }, refusingStorage(), NOW)).toBe(false)
    })
})

describe('readRememberedSearch', () => {
    it('returns what was written', () => {
        const storage = memoryStorage()
        writeRememberedSearch({ languages: [Locale.EnUs], region: 'KANTO' }, storage, NOW)

        expect(readRememberedSearch(storage, NOW + 1000)).toEqual({
            languages: [Locale.EnUs],
            region: 'KANTO',
            prefecture: undefined,
            city: undefined
        })
    })

    it('drops an entry older than the limit', () => {
        const storage = memoryStorage({ [REMEMBERED_SEARCH_STORAGE_KEY]: stored({ language: 'fr' }) })

        expect(readRememberedSearch(storage, NOW + REMEMBERED_SEARCH_MAX_AGE_MS + 1)).toBeUndefined()
        expect(storage.items.has(REMEMBERED_SEARCH_STORAGE_KEY)).toBe(false)
    })

    it('drops an entry saved in the future', () => {
        const storage = memoryStorage({ [REMEMBERED_SEARCH_STORAGE_KEY]: stored({ language: 'fr' }, NOW + 1000) })

        expect(readRememberedSearch(storage, NOW)).toBeUndefined()
        expect(storage.items.has(REMEMBERED_SEARCH_STORAGE_KEY)).toBe(false)
    })

    it('drops values that are no longer search options', () => {
        const storage = memoryStorage({
            [REMEMBERED_SEARCH_STORAGE_KEY]: stored({ language: 'klingon', prefecture: 'atlantis', city: 'x' })
        })

        expect(readRememberedSearch(storage, NOW)).toBeUndefined()
        expect(storage.items.has(REMEMBERED_SEARCH_STORAGE_KEY)).toBe(false)
    })

    it('ignores keys it never writes, such as a specialty', () => {
        const storage = memoryStorage({
            [REMEMBERED_SEARCH_STORAGE_KEY]: stored({ language: 'fr', specialty: 'psychiatry' })
        })

        expect(readRememberedSearch(storage, NOW)).toEqual({
            languages: [Locale.FrFr],
            region: undefined,
            prefecture: undefined,
            city: undefined
        })
    })

    it('treats a malformed or old-version value as nothing', () => {
        expect(readRememberedSearch(memoryStorage({ [REMEMBERED_SEARCH_STORAGE_KEY]: '{oops' }), NOW))
            .toBeUndefined()
        const oldVersion = JSON.stringify({ v: 0, savedAt: NOW, query: { language: 'fr' } })
        expect(readRememberedSearch(memoryStorage({ [REMEMBERED_SEARCH_STORAGE_KEY]: oldVersion }), NOW))
            .toBeUndefined()
    })

    it('returns nothing when storage refuses the read', () => {
        expect(readRememberedSearch(refusingStorage(), NOW)).toBeUndefined()
    })
})

describe('forgetRememberedSearch', () => {
    it('removes the entry', () => {
        const storage = memoryStorage({ [REMEMBERED_SEARCH_STORAGE_KEY]: stored({ language: 'fr' }) })

        forgetRememberedSearch(storage)

        expect(storage.items.has(REMEMBERED_SEARCH_STORAGE_KEY)).toBe(false)
    })
})

describe('rememberedFill', () => {
    const remembered = { languages: [Locale.FrFr], region: 'KANSAI' as const, prefecture: 'osaka', city: 'sakai' }

    it('fills a search that names neither', () => {
        expect(rememberedFill({ specialties: [Specialty.Dentistry] }, remembered)).toEqual(remembered)
    })

    it('keeps the language a link names and fills only the area', () => {
        expect(rememberedFill({ languages: [Locale.EnUs] }, remembered)).toEqual({
            region: 'KANSAI',
            prefecture: 'osaka',
            city: 'sakai'
        })
    })

    it('keeps the area a link names whole and fills only the language', () => {
        expect(rememberedFill({ prefecture: 'tokyo' }, remembered)).toEqual({ languages: [Locale.FrFr] })
        expect(rememberedFill({ region: 'KANTO' }, remembered)).toEqual({ languages: [Locale.FrFr] })
    })

    it('fills nothing when the link names both', () => {
        expect(rememberedFill({ languages: [Locale.EnUs], prefecture: 'tokyo' }, remembered)).toBeUndefined()
    })

    it('fills nothing when nothing is remembered', () => {
        expect(rememberedFill({}, undefined)).toBeUndefined()
    })
})
