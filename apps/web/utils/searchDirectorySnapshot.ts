import type { QueryClient } from '@tanstack/vue-query'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'
// Relative imports: nuxt.config.ts loads this file through utils/nuxt, before the ~ alias exists.
import { queryKeys } from './queryKeys'
import type { SearchDirectory } from './searchDirectoryQuery'

/**
 * The directory as the last `nuxi generate` saw it, served from the site's CDN (#242).
 * /search shows it at once and refreshes from the API in the background. When the API is
 * down, visitors still get the directory as of the last deploy.
 */
export const SEARCH_DIRECTORY_SNAPSHOT_PATH = '/_directory/search.json'

/** Bump when the file's shape changes, so an old file in a browser cache is ignored. */
export const SEARCH_DIRECTORY_SNAPSHOT_VERSION = 1

export interface SearchDirectorySnapshotFile {
    version: number
    /** ISO time of the build that wrote the file. */
    generatedAt: string
    facilities: Facility[]
    professionals: HealthcareProfessional[]
}

export interface SearchDirectorySnapshot {
    directory: SearchDirectory
    /** When the data was read from the API, in ms. vue-query treats it as that old. */
    updatedAt: number
}

/** Checks a downloaded file. Anything that is not the current shape is ignored. */
export function parseSearchDirectorySnapshot(value: unknown): SearchDirectorySnapshot | null {
    if (value === null || typeof value !== 'object') {
        return null
    }

    const file = value as Partial<SearchDirectorySnapshotFile>
    const updatedAt = typeof file.generatedAt === 'string' ? Date.parse(file.generatedAt) : Number.NaN
    if (file.version !== SEARCH_DIRECTORY_SNAPSHOT_VERSION
      || !Array.isArray(file.facilities)
      || !Array.isArray(file.professionals)
      || !Number.isFinite(updatedAt)) {
        return null
    }

    return { directory: { facilities: file.facilities, professionals: file.professionals }, updatedAt }
}

/** Downloads the snapshot. A missing file (dev, a preview build) or a bad one is null. */
export async function fetchSearchDirectorySnapshot(): Promise<SearchDirectorySnapshot | null> {
    try {
        const response = await fetch(SEARCH_DIRECTORY_SNAPSHOT_PATH, { headers: { accept: 'application/json' } })
        if (!response.ok) {
            return null
        }
        return parseSearchDirectorySnapshot(await response.json())
    } catch {
        return null
    }
}

const seededClients = new WeakSet<QueryClient>()

/**
 * Puts the snapshot in the search directory query once per app, unless the API has already
 * answered (#242). It carries the build time, so vue-query treats it as stale and the API
 * read still replaces it.
 */
export async function seedSearchDirectoryFromSnapshot(
    queryClient: QueryClient,
    fetchSnapshot: () => Promise<SearchDirectorySnapshot | null> = fetchSearchDirectorySnapshot
): Promise<void> {
    const key = queryKeys.searchDirectory()
    if (seededClients.has(queryClient) || queryClient.getQueryData(key) !== undefined) {
        return
    }
    seededClients.add(queryClient)

    const snapshot = await fetchSnapshot()
    if (!snapshot || queryClient.getQueryData(key) !== undefined) {
        return
    }

    queryClient.setQueryData<SearchDirectory>(key, snapshot.directory, { updatedAt: snapshot.updatedAt })
}
