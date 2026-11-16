import { Locale, SpecialtyCategory } from '@findadoc/graphql'
import type { Specialty } from '@findadoc/graphql'
import type { DirectoryStats } from './directoryStats'
import { specialtyFacetPathFromSlugs, specialtyFacetSlug } from './facetPath'
import { prefectureHubPath } from './hubPath'
import { specialtySearchParam } from './searchDirectory'

/**
 * Entry points for the homepage.
 *
 * The homepage must not pay for an API round trip before it can paint. The counts and the
 * prefecture list come from `#directory-stats`, which `nuxi generate` computes from the
 * directory it prerenders (`utils/directoryStats.ts`), so they are baked into the HTML and
 * match the build. The static values below are only the fallback for `nuxi dev` and a build
 * without the directory.
 */
export interface PrefectureEntry {
    /** Must match `contact.address.prefectureEn` exactly — it is used as the filter value. */
    name: string
    /** Shown to Japanese readers. Place names are data, not UI copy, so they are not i18n keys. */
    nameJa: string
    approximateFacilities: number
}

/**
 * Fallback prefecture list, measured against production on 2026-09-02.
 *
 * Ordered by volume rather than alphabetically because the distribution is uneven, so the
 * first handful covers most searches, and the ordering itself tells the reader where coverage
 * actually is. `directoryPrefectures` keeps the same order for the generated list.
 */
export const ALL_PREFECTURES: readonly PrefectureEntry[] = [
    { name: 'Tokyo', nameJa: '東京都', approximateFacilities: 96 },
    { name: 'Fukuoka', nameJa: '福岡県', approximateFacilities: 68 },
    { name: 'Osaka', nameJa: '大阪府', approximateFacilities: 43 },
    { name: 'Mie', nameJa: '三重県', approximateFacilities: 34 },
    { name: 'Hokkaido', nameJa: '北海道', approximateFacilities: 32 },
    { name: 'Tokushima', nameJa: '徳島県', approximateFacilities: 14 },
    { name: 'Tochigi', nameJa: '栃木県', approximateFacilities: 13 },
    { name: 'Ishikawa', nameJa: '石川県', approximateFacilities: 13 },
    { name: 'Hyogo', nameJa: '兵庫県', approximateFacilities: 12 },
    { name: 'Kagoshima', nameJa: '鹿児島県', approximateFacilities: 12 },
    { name: 'Fukui', nameJa: '福井県', approximateFacilities: 12 },
    { name: 'Yamanashi', nameJa: '山梨県', approximateFacilities: 11 },
    { name: 'Toyama', nameJa: '富山県', approximateFacilities: 11 },
    { name: 'Yamaguchi', nameJa: '山口県', approximateFacilities: 10 },
    { name: 'Akita', nameJa: '秋田県', approximateFacilities: 9 },
    { name: 'Miyagi', nameJa: '宮城県', approximateFacilities: 9 },
    { name: 'Okinawa', nameJa: '沖縄県', approximateFacilities: 8 },
    { name: 'Yamagata', nameJa: '山形県', approximateFacilities: 8 },
    { name: 'Kumamoto', nameJa: '熊本県', approximateFacilities: 6 },
    { name: 'Iwate', nameJa: '岩手県', approximateFacilities: 6 },
    { name: 'Fukushima', nameJa: '福島県', approximateFacilities: 6 },
    { name: 'Niigata', nameJa: '新潟県', approximateFacilities: 6 },
    { name: 'Nagano', nameJa: '長野県', approximateFacilities: 5 },
    { name: 'Ehime', nameJa: '愛媛県', approximateFacilities: 5 },
    { name: 'Kochi', nameJa: '高知県', approximateFacilities: 3 },
    { name: 'Kanagawa', nameJa: '神奈川県', approximateFacilities: 3 },
    { name: 'Oita', nameJa: '大分県', approximateFacilities: 2 },
    { name: 'Saga', nameJa: '佐賀県', approximateFacilities: 2 },
    { name: 'Aomori', nameJa: '青森県', approximateFacilities: 1 },
    { name: 'Saitama', nameJa: '埼玉県', approximateFacilities: 1 },
    { name: 'Aichi', nameJa: '愛知県', approximateFacilities: 1 },
    { name: 'Miyazaki', nameJa: '宮崎県', approximateFacilities: 1 },
    { name: 'Nagasaki', nameJa: '長崎県', approximateFacilities: 1 }
] as const

/**
 * Fallback directory size, measured against production on 2026-11-16, after the #21 import.
 * Framed in copy as approximate so it never reads as a live counter.
 */
export const DIRECTORY_STATS = {
    facilities: 1718,
    professionals: 405,
    languages: 14
} as const

/** How many prefecture chips "Browse by area" shows. */
const TOP_PREFECTURE_COUNT = 8

/** The subset shown as chips under "Browse by area" when generate has not filtered them. */
export const TOP_PREFECTURES: readonly PrefectureEntry[] = ALL_PREFECTURES.slice(0, TOP_PREFECTURE_COUNT)

/** The counts from this build's directory, or the fallback when the build has none. */
export function directoryCounts(
    generated: DirectoryStats | null | undefined
): { facilities: number, professionals: number, languages: number } {
    if (!generated || generated.facilities === 0) {
        return DIRECTORY_STATS
    }

    return {
        facilities: generated.facilities,
        professionals: generated.professionals,
        languages: generated.languages
    }
}

/** Prefectures with facilities in this build's directory, or the fallback list. */
export function directoryPrefectures(generated: DirectoryStats | null | undefined): readonly PrefectureEntry[] {
    return generated && generated.prefectures.length > 0 ? generated.prefectures : ALL_PREFECTURES
}

export type AreaPrefectureLink = string | { path: string, query: { prefecture: string } }

function prefectureIsInGenerate(
    prefecture: PrefectureEntry,
    generatedPrefectureHubs: readonly string[]
): boolean {
    const hub = prefectureHubPath(prefecture.name)
    return Boolean(hub && generatedPrefectureHubs.includes(hub))
}

/**
 * Area chips shown on the homepage.
 *
 * Production generate has the full directory, so this is the volume-ordered
 * top eight, each linking at `/tokyo` etc. Sparse CI seeds often have no Tokyo
 * row — emitting that chip as noindex `/search?prefecture=tokyo` is worse SEO
 * than showing the hubs this build actually prerendered. If generate found no
 * hubs at all (`[]`), keep the static top eight and let `areaPrefectureLink`
 * fall back to search so Nitro is not asked to crawl missing `/tokyo`.
 */
export function homeAreaPrefectures(
    generatedPrefectureHubs: readonly string[] | null | undefined,
    prefectures: readonly PrefectureEntry[] = ALL_PREFECTURES
): readonly PrefectureEntry[] {
    const topPrefectures = prefectures === ALL_PREFECTURES
        ? TOP_PREFECTURES
        : prefectures.slice(0, TOP_PREFECTURE_COUNT)
    if (!Array.isArray(generatedPrefectureHubs) || generatedPrefectureHubs.length === 0) {
        return topPrefectures
    }

    const top = topPrefectures.filter(entry => prefectureIsInGenerate(entry, generatedPrefectureHubs))
    if (top.length > 0) {
        return top
    }

    const rest = prefectures.filter(entry => prefectureIsInGenerate(entry, generatedPrefectureHubs))
    return rest.length > 0 ? rest.slice(0, TOP_PREFECTURE_COUNT) : topPrefectures
}

/**
 * Homepage area chips prefer the prefecture hub (`/tokyo`) so crawlers walk the
 * directory from `/`. During `nuxi generate`, only hubs present in this build
 * are linked — a chip for Osaka against a Tokyo-only seed would 404 and abort
 * Nitro. Those chips fall back to `/search?prefecture=…`, which is SPA
 * (`ssr: false`) and skipped by the crawler.
 *
 * `generatedPrefectureHubs` is an array only during generate (`[]` if the
 * directory fetch failed). Anything else, including `null` in `nuxi dev`,
 * means do not filter.
 */
export function areaPrefectureLink(
    prefecture: PrefectureEntry,
    generatedPrefectureHubs: readonly string[] | null | undefined
): AreaPrefectureLink {
    const hub = prefectureHubPath(prefecture.name)
    const searchLink = {
        path: '/search',
        query: { prefecture: prefecture.name.toLowerCase() }
    }

    if (Array.isArray(generatedPrefectureHubs)) {
        return hub && generatedPrefectureHubs.includes(hub) ? hub : searchLink
    }

    return hub ?? searchLink
}

/**
 * Largest directory coverage. Homepage "Browse by need" chips prefer this
 * prefecture's specialty facet (`/tokyo/dentistry`) so crawlers and people land
 * on an indexable page instead of noindex `/search?specialty=…` (#1828).
 */
export const HOME_NEED_PREFECTURE_SLUG = 'tokyo'

export type CategorySpecialtyLink = string | { path: string, query: { specialty: string } }

/**
 * Prefer the Tokyo specialty facet when it exists. During generate, only facets
 * present in this build are linked; otherwise fall back to filtered search
 * (SPA, skipped by the prerender crawler). Outside generate, always prefer the
 * Tokyo facet path.
 */
export function categorySpecialtyLink(
    specialty: Specialty,
    generatedFacetPaths: readonly string[] | null | undefined
): CategorySpecialtyLink {
    const searchLink = {
        path: '/search',
        query: { specialty: specialtySearchParam(specialty) }
    }
    const preferred = specialtyFacetPathFromSlugs(HOME_NEED_PREFECTURE_SLUG, specialty)
    const slug = specialtyFacetSlug(specialty)

    if (Array.isArray(generatedFacetPaths)) {
        if (preferred && generatedFacetPaths.includes(preferred)) {
            return preferred
        }
        if (slug) {
            const alternate = generatedFacetPaths.find(path => path.endsWith(`/${slug}`))
            if (alternate) {
                return alternate
            }
        }
        return searchLink
    }

    return preferred ?? searchLink
}

/**
 * Every language at least one registered professional speaks.
 *
 * English is first because it is the default. Japanese is next as the host-country
 * language. Remaining locales follow foreign-resident population in Japan
 * (Immigration Services Agency, end of 2025) among languages that actually appear
 * in the directory.
 *
 * Deliberately not the whole `Locale` enum, which carries 40+ values: offering a
 * language nobody in the directory speaks sends the user to a guaranteed empty result.
 */
export const SEARCHABLE_LANGUAGES: readonly Locale[] = [
    Locale.EnUs,
    Locale.JaJp,
    Locale.ZhCn,
    Locale.KoKr,
    Locale.TlPh,
    Locale.NeNp,
    Locale.IdId,
    Locale.ZhHk,
    Locale.EsEs,
    Locale.FrFr,
    Locale.ArAe,
    Locale.DeDe,
    Locale.NlBe,
    Locale.SwKe
] as const

/** The category tiles under "Browse by need", in the order they are shown. */
export const BROWSE_CATEGORIES: readonly SpecialtyCategory[] = [
    SpecialtyCategory.PrimaryCare,
    SpecialtyCategory.Dental,
    SpecialtyCategory.MentalHealth,
    SpecialtyCategory.ChildrensHealth,
    SpecialtyCategory.WomensHealth,
    SpecialtyCategory.Dermatology,
    SpecialtyCategory.EyeAndVision,
    SpecialtyCategory.Ent
] as const
