import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'
import {
    SEARCH_DIRECTORY_SNAPSHOT_PATH,
    SEARCH_DIRECTORY_SNAPSHOT_VERSION,
    type SearchDirectorySnapshotFile
} from '../searchDirectorySnapshot'

/**
 * Writes the /search snapshot into the publish dir at the end of `nuxi generate` (#242).
 * Only a complete directory is written: a partial one would hide clinics until the API answers.
 * @returns Whether a file was written.
 */
export async function writeSearchDirectorySnapshot(
    publicDir: string,
    rows: { facilities: Facility[], professionals: HealthcareProfessional[], complete: boolean } | null | undefined,
    now: Date = new Date()
): Promise<boolean> {
    if (!rows?.complete) {
        return false
    }

    const file = {
        version: SEARCH_DIRECTORY_SNAPSHOT_VERSION,
        generatedAt: now.toISOString(),
        facilities: rows.facilities,
        professionals: rows.professionals
    } satisfies SearchDirectorySnapshotFile

    const target = join(publicDir, SEARCH_DIRECTORY_SNAPSHOT_PATH)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, JSON.stringify(file))
    return true
}
