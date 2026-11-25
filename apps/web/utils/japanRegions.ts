import { listPrefectureJapanEn, listPrefectureJapanJa } from './prefectureNames'

/**
 * The eight regions search offers before a prefecture: region, then prefecture, then city.
 * This is the common eight-region split. Okinawa is filed with Kyushu, and Mie with Kansai,
 * because that is how people in Japan usually group them.
 */
export const JAPAN_REGION = {
    HOKKAIDO: 'HOKKAIDO',
    TOHOKU: 'TOHOKU',
    KANTO: 'KANTO',
    CHUBU: 'CHUBU',
    KANSAI: 'KANSAI',
    CHUGOKU: 'CHUGOKU',
    SHIKOKU: 'SHIKOKU',
    KYUSHU: 'KYUSHU'
} as const

export type JapanRegion = typeof JAPAN_REGION[keyof typeof JAPAN_REGION]

/** North to south, the order the picker shows. */
export const JAPAN_REGIONS: readonly JapanRegion[] = Object.values(JAPAN_REGION)

/** The English prefecture names (as in `prefectureNames.ts`) in each region, in code order. */
export const REGION_PREFECTURES: Readonly<Record<JapanRegion, readonly string[]>> = {
    HOKKAIDO: ['Hokkaido'],
    TOHOKU: ['Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima'],
    KANTO: ['Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa'],
    CHUBU: ['Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi'],
    KANSAI: ['Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama'],
    CHUGOKU: ['Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi'],
    SHIKOKU: ['Tokushima', 'Kagawa', 'Ehime', 'Kochi'],
    KYUSHU: ['Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa']
}

/** The i18n key for a region's name. */
export const REGION_LABEL_KEYS: Readonly<Record<JapanRegion, string>> = {
    HOKKAIDO: 'regions.hokkaido',
    TOHOKU: 'regions.tohoku',
    KANTO: 'regions.kanto',
    CHUBU: 'regions.chubu',
    KANSAI: 'regions.kansai',
    CHUGOKU: 'regions.chugoku',
    SHIKOKU: 'regions.shikoku',
    KYUSHU: 'regions.kyushu'
}

const REGION_BY_PREFECTURE = new Map<string, JapanRegion>()
for (const region of JAPAN_REGIONS) {
    for (const prefecture of REGION_PREFECTURES[region]) {
        REGION_BY_PREFECTURE.set(prefecture.toLowerCase(), region)
        const index = listPrefectureJapanEn.indexOf(prefecture)
        const japanese = listPrefectureJapanJa[index]
        if (japanese !== undefined) {
            REGION_BY_PREFECTURE.set(japanese, region)
        }
    }
}

export function isJapanRegion(value: unknown): value is JapanRegion {
    return typeof value === 'string' && (JAPAN_REGIONS as readonly string[]).includes(value)
}

/** `kanto` in the URL. */
export function regionSearchParam(region: JapanRegion): string {
    return region.toLowerCase()
}

/** A region from a URL param or an enum value, or undefined for anything else. */
export function parseRegion(raw: string | undefined): JapanRegion | undefined {
    if (raw === undefined) {
        return undefined
    }
    const upper = raw.trim().toUpperCase()
    return isJapanRegion(upper) ? upper : undefined
}

/**
 * The region a prefecture belongs to, from its English name, its URL slug (`tokyo`), or its
 * Japanese name (`東京都`). Accents and stray punctuation are ignored (`Tōkyō`, `Tokyo.`).
 * Undefined for anything that is not one of the 47.
 */
export function regionOfPrefecture(prefecture: string | null | undefined): JapanRegion | undefined {
    if (prefecture === null || prefecture === undefined) {
        return undefined
    }
    const trimmed = prefecture.trim()
    return REGION_BY_PREFECTURE.get(foldLatin(trimmed)) ?? REGION_BY_PREFECTURE.get(trimmed)
}

/**
 * `Tōkyō` or `Tokyo.` → `tokyo`: the same folding as `slugify` in `searchDirectory.ts`, so the
 * region filter agrees with the prefecture filter on the same name.
 */
function foldLatin(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * The region an area value names, when it is a region slug (`kanto`) and not a prefecture.
 * The homepage's one "Where?" list holds both, so `hokkaido` stays the prefecture.
 */
export function regionFromAreaValue(value: string | undefined): JapanRegion | undefined {
    return regionOfPrefecture(value) === undefined ? parseRegion(value) : undefined
}

/** The entries whose prefecture is in the region, in their given order. No region keeps them all. */
export function prefecturesInRegion<T extends { name: string }>(
    entries: readonly T[],
    region: JapanRegion | undefined
): T[] {
    if (region === undefined) {
        return [...entries]
    }
    return entries.filter(entry => regionOfPrefecture(entry.name) === region)
}

/**
 * The regions that hold at least one of the given prefectures, north to south. A region
 * already picked stays in the list so a link to an empty region still shows what it asked for.
 */
export function regionsWithPrefectures(
    entries: readonly { name: string }[],
    selected: JapanRegion | undefined
): JapanRegion[] {
    const present = new Set(entries.map(entry => regionOfPrefecture(entry.name)))
    return JAPAN_REGIONS.filter(region => present.has(region) || region === selected)
}
