import { readFileSync, writeFileSync } from 'node:fs'
import type { buildClinicPrerenderDirectory } from './clinicPrerender'

/**
 * The directory one generate renders from, saved to a file.
 *
 * `pnpm --filter @findadoc/web prerender:directory` fetches it once. Every prerender shard then reads
 * the same file through `NUXT_PRERENDER_DIRECTORY_FILE` instead of calling the API, so the shards
 * agree on which clinics, doctors, hubs, and facets exist and on what each page links to.
 */
export const PRERENDER_DIRECTORY_FILE_ENV = 'NUXT_PRERENDER_DIRECTORY_FILE'

/** Bump when the shape changes, so a shard never reads a file from another version of this code. */
export const PRERENDER_DIRECTORY_SNAPSHOT_VERSION = 1

export type PrerenderDirectory = NonNullable<Awaited<ReturnType<typeof buildClinicPrerenderDirectory>>>

type Snapshot = { version: number, fetchedAt: string, directory: PrerenderDirectory }

export function writePrerenderDirectorySnapshot(path: string, directory: PrerenderDirectory, now = new Date()): void {
    const snapshot: Snapshot = {
        version: PRERENDER_DIRECTORY_SNAPSHOT_VERSION,
        fetchedAt: now.toISOString(),
        directory
    }
    writeFileSync(path, JSON.stringify(snapshot))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/**
 * Read the file a shard renders from. A missing, unreadable, or older file throws: a shard that
 * quietly fetched the API instead could disagree with the other shards.
 */
export function readPrerenderDirectorySnapshot(path: string): PrerenderDirectory {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!isRecord(parsed) || parsed.version !== PRERENDER_DIRECTORY_SNAPSHOT_VERSION || !isRecord(parsed.directory)) {
        throw new Error(`${path} is not a version ${PRERENDER_DIRECTORY_SNAPSHOT_VERSION} prerender directory`)
    }

    const directory = parsed.directory
    const listsOk = ['paths', 'professionalPaths', 'hubPaths', 'facetPaths'].every(key => isStringArray(directory[key]))
    const rows = directory.rows
    const rowsOk = isRecord(rows) && Array.isArray(rows.facilities) && Array.isArray(rows.professionals)
      && typeof rows.complete === 'boolean'
    const citiesOk = directory.officialCities === null || Array.isArray(directory.officialCities)
    if (!isRecord(directory.directory) || !isRecord(directory.professionalDirectory) || !listsOk || !rowsOk
      || !citiesOk) {
        throw new Error(`${path} is missing part of the prerender directory`)
    }

    // The checks above match the shape writePrerenderDirectorySnapshot wrote.
    return directory as PrerenderDirectory
}
