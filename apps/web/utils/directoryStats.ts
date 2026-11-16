import type { Locale } from '@findadoc/graphql'
import type { PrefectureEntry } from './homeDirectory'
import { listPrefectureJapanEn, listPrefectureJapanJa } from './prefectureNames'

/** The directory counts the homepage, the about page, and the prefecture pickers show. */
export interface DirectoryStats {
    facilities: number
    professionals: number
    languages: number
    /** Prefectures with at least one facility, most facilities first. */
    prefectures: PrefectureEntry[]
}

/** The facility fields the counts read. Structural, so a test can pass a small object. */
export interface StatsFacility {
    contact?: { address?: { prefectureEn?: string | null } | null } | null
    supportedLanguages?: readonly Locale[] | null
}

/** The professional fields the counts read. */
export interface StatsProfessional {
    spokenLanguages?: readonly Locale[] | null
}

function prefectureCounts(facilities: readonly StatsFacility[]): PrefectureEntry[] {
    const counts = new Map<number, number>()
    for (const facility of facilities) {
        const index = listPrefectureJapanEn.indexOf(facility.contact?.address?.prefectureEn ?? '')
        if (index !== -1) {
            counts.set(index, (counts.get(index) ?? 0) + 1)
        }
    }

    return [...counts.entries()]
        .map(([index, count]) => ({
            name: listPrefectureJapanEn[index] ?? '',
            nameJa: listPrefectureJapanJa[index] ?? '',
            approximateFacilities: count
        }))
        .sort((left, right) => right.approximateFacilities - left.approximateFacilities
          || left.name.localeCompare(right.name))
}

/**
 * Counts from the directory this build prerenders, so the homepage and about page stay in step
 * with the site instead of a number measured by hand. Only a standard prefecture name counts
 * toward a prefecture; an online facility has no address and counts only toward the total.
 * A language counts once if any facility or professional lists it.
 */
export function directoryStatsFrom(
    facilities: readonly StatsFacility[],
    professionals: readonly StatsProfessional[]
): DirectoryStats {
    const languages = new Set<Locale>()
    for (const facility of facilities) {
        for (const language of facility.supportedLanguages ?? []) {
            languages.add(language)
        }
    }
    for (const professional of professionals) {
        for (const language of professional.spokenLanguages ?? []) {
            languages.add(language)
        }
    }

    return {
        facilities: facilities.length,
        professionals: professionals.length,
        languages: languages.size,
        prefectures: prefectureCounts(facilities)
    }
}
