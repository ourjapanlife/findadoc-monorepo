import { prefectureTranslations, resolvePrefectureKey } from '../../utils/japanesePrefectures.js'
import { toJapanE164 } from '../../utils/stringUtils.js'
import { PUBLISHED_LOCALES, type PublishedLocale } from '../languages/publishedLocales.js'
import {
    resolveFacilityLocation,
    vocabularyCities,
    type CanonicalCity,
    type OfficialMunicipality
} from './cityMap.js'
import { mapLanguage } from './languageMap.js'

/**
 * The multilingual institutions spreadsheet (#21): parse one row, match it to a facility, and plan
 * what the importer does with it. Everything here is pure, so the dry-run and the tests see the same
 * decisions. The database and Places calls live in utils/importInstitutionList.ts.
 */

/** The volunteer progress mark on a row (see utils/exportInstitutionList.py). */
export const ROW_COLOUR = {
    GREEN: 'green',
    RED: 'red',
    YELLOW: 'yellow',
    NONE: 'none'
} as const

export type RowColour = typeof ROW_COLOUR[keyof typeof ROW_COLOUR]

export function isRowColour(value: unknown): value is RowColour {
    return typeof value === 'string' && (Object.values(ROW_COLOUR) as string[]).includes(value)
}

export const IMPORT_OUTCOME = {
    STAGED: 'staged',
    MATCHED: 'matched',
    CREATED: 'created',
    NEEDS_REVIEW: 'needs_review',
    SKIPPED: 'skipped'
} as const

export type ImportOutcome = typeof IMPORT_OUTCOME[keyof typeof IMPORT_OUTCOME]

export const MATCH_METHOD = {
    PLACE_ID: 'place_id',
    MAPS_URL: 'maps_url',
    NAME_POSTAL_CODE: 'name_postal_code',
    PHONE: 'phone'
} as const

export type MatchMethod = typeof MATCH_METHOD[keyof typeof MATCH_METHOD]

/** Header text in the sheet, after the exporter drops the ※ and ○ hints. */
export const SHEET_HEADER = {
    PREFECTURE: '都道府県',
    NAME_JA: '医療機関',
    NAME_EN: '医療機関(英語)',
    POSTAL_CODE: '郵便番号',
    ADDRESS_JA: '住所',
    ADDRESS_EN: '住所(英語)',
    PHONE: '電話番号',
    WEBSITE: 'WEBサイト',
    DEPARTMENTS_AND_LANGUAGES: '対応診療科と対応外国語'
} as const

export type SheetRow = {
    sheet: string
    rowNumber: number
    colour: RowColour
    raw: Record<string, string>
}

/** What the importer would store for a row. Only our own columns, never Places content. */
export type InstitutionRecord = {
    nameJa: string
    nameEn: string
    postalCode: string
    prefectureEn: string | null
    prefectureJa: string
    city: CanonicalCity | null
    addressLine1Ja: string
    addressLine1En: string
    /** Full Japanese address as the sheet wrote it, for the Places query. */
    addressJa: string
    phone: string
    website: string
    languages: PublishedLocale[]
    warnings: string[]
}

/** The facility fields the matcher and the fill step read. */
export type ExistingFacility = {
    id: string
    nameJa: string
    postalCode: string
    phone: string
    website: string
    googlePlaceId: string | null
    googleMapsUrl: string
    verificationStatus: string
    supportedLanguages: readonly string[]
}

export type FacilityMatch = {
    facility: ExistingFacility
    method: MatchMethod
}

/** Result of the id-only Places search for one row. `null` means it was not run. */
export type PlaceLookup = { placeIds: string[] } | null

/** Fields to write onto a matched facility. Every key here was empty on that facility. */
export type FacilityFill = {
    phone?: string
    website?: string
    postalCode?: string
    supportedLanguages?: PublishedLocale[]
}

export type RowPlan = {
    outcome: ImportOutcome
    reason: string | null
    match: FacilityMatch | null
    placeId: string | null
    fill: FacilityFill
}

const CORPORATE_PREFIX = new RegExp(
    '^(医療法人社団|医療法人財団|特定医療法人|社会医療法人|医療法人|社会福祉法人|一般社団法人|一般財団法人|'
    + '公益社団法人|公益財団法人|地方独立行政法人|独立行政法人|国立大学法人|公立大学法人|学校法人|宗教法人)'
)
const MIN_CONTAINED_NAME = 4
const URL_PATTERN = /https?:\/\/[^\s、，,（()）「」<>"']+/i
const LANGUAGE_TOKEN = /[A-Z]{2,}(?:-[A-Z]{2})?|[゠-ヿ一-鿿]+語/g
const PREFECTURE_SUFFIX = /(-|\s)?(ken|fu|to|prefecture|pref\.?)$/i
const CITY_SUFFIX = /(-|\s)?(shi|city|ku|ward|machi|cho|town|mura|son|village|gun)$/i

function nfkc(value: string | null | undefined): string {
    return (value ?? '').normalize('NFKC')
}

/** Collapse whitespace and line breaks the sheet put inside one value. */
function oneLine(value: string | null | undefined): string {
    return nfkc(value).replace(/\s+/g, ' ').trim()
}

/** Japanese name with spaces, line breaks, and a leading corporation name removed, for matching only. */
export function matchableNameJa(name: string): string {
    const compact = nfkc(name).replace(/\s+/g, '')
    const spaced = nfkc(name).trim().split(/\s+/)

    // "医療法人徳州会 札幌東徳州会病院": the part after the corporation is the facility.
    if (spaced.length > 1 && CORPORATE_PREFIX.test(spaced[0] ?? '')) {
        return spaced.slice(1).join('')
    }

    return compact
}

/** True when one name is the other, or holds it, and the shorter one is long enough to mean something. */
export function namesMatch(left: string, right: string): boolean {
    const a = matchableNameJa(left)
    const b = matchableNameJa(right)

    if (!a || !b) {
        return false
    }
    if (a === b) {
        return true
    }

    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
    return shorter.length >= MIN_CONTAINED_NAME && longer.includes(shorter)
}

/** "0410802" or "041-0802" is "041-0802". Anything else is empty. */
export function postalCodeForStorage(value: string): string {
    const digits = nfkc(value).replace(/\D/g, '')
    return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : ''
}

/**
 * The first link in the cell, as https. The sheet often lists one site per language and still
 * writes http; a stored link must be https (AGENTS.md), so the scheme is upgraded and noted.
 */
export function websiteForStorage(value: string): { website: string, upgraded: boolean } {
    const found = nfkc(value).match(URL_PATTERN)?.[0]
    if (!found) {
        return { website: '', upgraded: false }
    }

    try {
        const url = new URL(found)
        const upgraded = url.protocol === 'http:'
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return { website: '', upgraded: false }
        }
        if (!url.hostname.includes('.')) {
            return { website: '', upgraded: false }
        }
        url.protocol = 'https:'
        return { website: url.toString(), upgraded }
    } catch {
        return { website: '', upgraded: false }
    }
}

/** "IdeEyeHospital" is "Ide Eye Hospital". A name that already has a space is left alone. */
export function spacedEnglishName(value: string): string {
    const name = oneLine(value)
    if (name.includes(' ')) {
        return name
    }
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

function locale(code: string): PublishedLocale | null {
    const outcome = mapLanguage(code)
    return outcome.status === 'mapped' ? outcome.value : null
}

/** Run-together codes such as "ENZHKOES", when every pair is a code we know. */
function splitRunTogether(token: string): PublishedLocale[] | null {
    if (token.length <= 3 || token.length % 2 !== 0 || token.includes('-')) {
        return null
    }

    const pairs = token.match(/.{2}/g) ?? []
    const locales = pairs.map(pair => locale(pair))
    return locales.every(value => value !== null) ? locales as PublishedLocale[] : null
}

/**
 * Published languages named in the departments column, in directory order, with Japanese first
 * after English. The column lists the foreign languages; every institution on the list is a
 * Japanese clinic, so Japanese is added. Codes we do not publish are dropped here and kept in raw.
 * This is the facility-level language list (#19). No professional is made from it.
 */
export function languagesFromDepartments(value: string): { languages: PublishedLocale[], dropped: string[] } {
    const found = new Set<PublishedLocale>(['ja_JP'])
    const dropped = new Set<string>()

    for (const token of nfkc(value).match(LANGUAGE_TOKEN) ?? []) {
        const direct = locale(token)
        if (direct) {
            found.add(direct)
            continue
        }

        const split = splitRunTogether(token)
        if (split) {
            split.forEach(language => found.add(language))
            continue
        }

        if (token.length <= 3 || token.endsWith('語')) {
            dropped.add(token)
        }
    }

    return {
        languages: PUBLISHED_LOCALES.filter(language => found.has(language)),
        dropped: [...dropped].sort()
    }
}

function prefectureOf(row: SheetRow): string | null {
    const fromCell = oneLine(row.raw[SHEET_HEADER.PREFECTURE]).replace(/^\d+/, '')
    const fromSheet = row.sheet.replace(/^\d+\./, '')
    return resolvePrefectureKey(fromCell) ?? resolvePrefectureKey(fromSheet) ?? null
}

/** The Japanese address with the prefecture and the city removed, the way facilities store it. */
function addressLineJa(address: string, prefectureJa: string, city: CanonicalCity | null): string {
    const withoutPrefecture = address.startsWith(prefectureJa) ? address.slice(prefectureJa.length) : address
    if (!city) {
        return withoutPrefecture
    }

    const at = withoutPrefecture.indexOf(city.nameJa)
    return at >= 0 ? withoutPrefecture.slice(at + city.nameJa.length) : withoutPrefecture
}

function sameName(part: string, name: string, suffix: RegExp): boolean {
    const cleaned = part.toLowerCase().replace(suffix, '').replace(/[\s-]/g, '')
    return cleaned !== '' && cleaned === name.toLowerCase().replace(/[\s-]/g, '')
}

/** The English address without the postal code, Japan, the prefecture, and the city. */
function addressLineEn(address: string, prefectureEn: string | null, city: CanonicalCity | null): string {
    const parts = address.split(',').map(part => part.trim()).filter(Boolean)
    const kept = parts.filter(part => {
        if (/^\d{3}-?\d{4}$/.test(part.replace(/\s/g, '')) || /^japan$/i.test(part)) {
            return false
        }
        if (prefectureEn && sameName(part, prefectureEn, PREFECTURE_SUFFIX)) {
            return false
        }
        return !(city && sameName(part, city.nameEn, CITY_SUFFIX))
    })
    return kept.length ? kept.join(', ') : address
}

type CityFromAddresses = { city: CanonicalCity } | { reason: string }

const ENGLISH_CITY = /([a-z]+)[\s-]?(shi|city|ku|ward)\b/g

function compactEnglish(value: string): string {
    return value.toLowerCase().replace(/[^a-z]/g, '')
}

/**
 * Municipalities the English address names with an explicit suffix: "Chiyoda-ku", "Hanamaki-shi",
 * "Kawagoe City". A bare word is not read, because the transliteration is loose and a district or a
 * prefecture often shares a town's name ("Iwate", "Aki-gun").
 */
function citiesNamedInEnglish(address: string, prefectureEn: string): OfficialMunicipality[] {
    const named: OfficialMunicipality[] = []
    for (const match of nfkc(address).toLowerCase().matchAll(ENGLISH_CITY)) {
        const name = match[1] ?? ''
        const ward = match[2] === 'ku' || match[2] === 'ward'
        named.push(...vocabularyCities().filter(city => city.prefectureEn === prefectureEn
            && compactEnglish(city.nameEn) === name
            && city.nameJa.endsWith(ward ? '区' : '市')))
    }
    return named
}

/**
 * The Japanese address names the city. The English one only counts when it clearly names a
 * different municipality: then the row stays unresolved, because a pair that names two places is
 * not guessed (docs/city-rules.md).
 */
function cityFromAddresses(prefectureEn: string, addressLine1Ja: string, addressEn: string): CityFromAddresses {
    const ja = resolveFacilityLocation({ prefectureEn, cityEn: '', cityJa: '', addressLine1Ja, addressLine1En: '' })
    if (ja.status !== 'mapped') {
        return { reason: ja.reason }
    }

    if (citiesNamedInEnglish(addressEn, prefectureEn).some(city => city.nameJa !== ja.value.nameJa)) {
        return { reason: 'language_disagreement' }
    }
    return { city: ja.value }
}

/** One sheet row as the values the importer would store, with what it had to change noted. */
export function parseInstitutionRow(row: SheetRow): InstitutionRecord {
    const warnings: string[] = []
    const prefectureEn = prefectureOf(row)
    const prefectureJa = prefectureEn ? prefectureTranslations[prefectureEn] ?? '' : ''
    const addressJa = nfkc(row.raw[SHEET_HEADER.ADDRESS_JA]).replace(/\s+/g, '')
    const addressEn = oneLine(row.raw[SHEET_HEADER.ADDRESS_EN])
    const nameEnSource = oneLine(row.raw[SHEET_HEADER.NAME_EN])
    const nameEn = spacedEnglishName(nameEnSource)

    if (!prefectureEn) {
        warnings.push('unknown_prefecture')
    }

    const addressAfterPrefecture = addressJa.startsWith(prefectureJa) ? addressJa.slice(prefectureJa.length) : addressJa
    const located = prefectureEn ? cityFromAddresses(prefectureEn, addressAfterPrefecture, addressEn) : null
    const city = located && 'city' in located ? located.city : null
    if (located && 'reason' in located) {
        warnings.push(`city_${located.reason}`)
    }

    const postalCode = postalCodeForStorage(row.raw[SHEET_HEADER.POSTAL_CODE] ?? '')
    if (!postalCode) {
        warnings.push('invalid_postal_code')
    }

    const phone = toJapanE164(oneLine(row.raw[SHEET_HEADER.PHONE]).replace(/[(（].*$/, '')) ?? ''
    if (!phone) {
        warnings.push('invalid_phone')
    }

    const site = websiteForStorage(row.raw[SHEET_HEADER.WEBSITE] ?? '')
    if (site.upgraded) {
        warnings.push('website_upgraded_to_https')
    }

    if (nameEn !== nameEnSource) {
        warnings.push('english_name_spaced')
    }

    const { languages, dropped } = languagesFromDepartments(row.raw[SHEET_HEADER.DEPARTMENTS_AND_LANGUAGES] ?? '')
    if (dropped.length) {
        warnings.push(`unpublished_languages:${dropped.join(',')}`)
    }

    return {
        nameJa: oneLine(row.raw[SHEET_HEADER.NAME_JA]),
        nameEn,
        postalCode,
        prefectureEn,
        prefectureJa,
        city,
        addressLine1Ja: addressLineJa(addressJa, prefectureJa, city),
        addressLine1En: addressLineEn(addressEn, prefectureEn, city),
        addressJa,
        phone,
        website: site.website,
        languages,
        warnings
    }
}

/** Text for the id-only Places search: the Japanese name and the full Japanese address. */
export function placeQuery(record: InstitutionRecord): string {
    const address = record.addressJa.startsWith(record.prefectureJa)
        ? record.addressJa
        : `${record.prefectureJa}${record.addressJa}`
    return `${record.nameJa} ${address}`.trim()
}

/** Facilities looked up by the keys the matcher uses. */
export type FacilityIndex = {
    byPlaceId: Map<string, ExistingFacility[]>
    byMapsPlaceId: Map<string, ExistingFacility[]>
    byPostalCode: Map<string, ExistingFacility[]>
    byPhone: Map<string, ExistingFacility[]>
}

function push(map: Map<string, ExistingFacility[]>, key: string, facility: ExistingFacility): void {
    if (!key) {
        return
    }
    map.set(key, [...map.get(key) ?? [], facility])
}

function placeIdInMapsUrl(url: string): string {
    try {
        return new URL(url).searchParams.get('query_place_id') ?? ''
    } catch {
        return ''
    }
}

export function indexFacilities(facilities: readonly ExistingFacility[]): FacilityIndex {
    const index: FacilityIndex = {
        byPlaceId: new Map(),
        byMapsPlaceId: new Map(),
        byPostalCode: new Map(),
        byPhone: new Map()
    }
    for (const facility of facilities) {
        push(index.byPlaceId, facility.googlePlaceId ?? '', facility)
        push(index.byMapsPlaceId, placeIdInMapsUrl(facility.googleMapsUrl), facility)
        push(index.byPostalCode, postalCodeForStorage(facility.postalCode), facility)
        push(index.byPhone, toJapanE164(facility.phone) ?? '', facility)
    }
    return index
}

function only(candidates: readonly ExistingFacility[] | undefined): ExistingFacility | null {
    return candidates?.length === 1 ? candidates[0] ?? null : null
}

/**
 * Match in the order #21 sets: place id, then the place in a Maps URL, then the Japanese name with
 * the postal code. A phone that only one facility has is the last step; the sheet carries no place id
 * or Maps URL, so on a first run most rows match here or by name. A key that two facilities share is
 * not a match.
 */
export function matchFacility(
    record: InstitutionRecord,
    placeId: string | null,
    index: FacilityIndex
): FacilityMatch | null {
    if (placeId) {
        const byPlace = only(index.byPlaceId.get(placeId))
        if (byPlace) {
            return { facility: byPlace, method: MATCH_METHOD.PLACE_ID }
        }

        const byMaps = only(index.byMapsPlaceId.get(placeId))
        if (byMaps) {
            return { facility: byMaps, method: MATCH_METHOD.MAPS_URL }
        }
    }

    const byName = only((index.byPostalCode.get(record.postalCode) ?? [])
        .filter(facility => namesMatch(facility.nameJa, record.nameJa)))
    if (byName) {
        return { facility: byName, method: MATCH_METHOD.NAME_POSTAL_CODE }
    }

    const byPhone = only(index.byPhone.get(record.phone))
    if (byPhone) {
        return { facility: byPhone, method: MATCH_METHOD.PHONE }
    }

    return null
}

function comparableWebsite(value: string): string {
    return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

/**
 * Fill only what the facility leaves empty. A value that differs from a CONFIRMED facility's is a
 * conflict for a moderator; an UNVERIFIED facility keeps its value too, and nothing is overwritten.
 */
export function planFill(
    record: InstitutionRecord,
    facility: ExistingFacility
): { fill: FacilityFill, conflicts: string[] } {
    const fill: FacilityFill = {}
    const conflicts: string[] = []
    const storedPhone = toJapanE164(facility.phone) ?? facility.phone.trim()

    if (!facility.phone.trim() && record.phone) {
        fill.phone = record.phone
    } else if (record.phone && storedPhone !== record.phone) {
        conflicts.push('phone')
    }

    if (!facility.website.trim() && record.website) {
        fill.website = record.website
    } else if (record.website && comparableWebsite(facility.website) !== comparableWebsite(record.website)) {
        conflicts.push('website')
    }

    if (!facility.postalCode.trim() && record.postalCode) {
        fill.postalCode = record.postalCode
    } else if (record.postalCode && postalCodeForStorage(facility.postalCode) !== record.postalCode) {
        conflicts.push('postal_code')
    }

    if (facility.supportedLanguages.length === 0 && record.languages.length) {
        fill.supportedLanguages = record.languages
    }

    return { fill, conflicts: facility.verificationStatus === 'CONFIRMED' ? conflicts : [] }
}

function review(reason: string, match: FacilityMatch | null = null, placeId: string | null = null): RowPlan {
    return { outcome: IMPORT_OUTCOME.NEEDS_REVIEW, reason, match, placeId, fill: {} }
}

/** The one place id a lookup found, or why there is not one. */
function placeFromLookup(lookup: PlaceLookup): { placeId: string } | { reason: string } {
    if (!lookup) {
        return { reason: 'place_lookup_not_run' }
    }
    const [first, ...rest] = lookup.placeIds
    if (!first) {
        return { reason: 'no_place_found' }
    }
    if (rest.length) {
        return { reason: 'several_places_found' }
    }
    return { placeId: first }
}

/**
 * Decide one row.
 *
 * - Red rows were reviewed and left out: staged and skipped, even when they match.
 * - A match fills empty fields only. Green rows are expected to match.
 * - Yellow and unmarked rows that match nothing become a new UNVERIFIED facility, but only with one
 *   Places id that no facility and no earlier row already holds.
 *
 * `claimedPlaceIds` holds ids that rows earlier in this run created facilities for.
 */
export function planRow(
    row: SheetRow,
    record: InstitutionRecord,
    lookup: PlaceLookup,
    index: FacilityIndex,
    claimedPlaceIds: ReadonlySet<string>
): RowPlan {
    const found = placeFromLookup(lookup)
    const placeId = 'placeId' in found ? found.placeId : null
    const match = matchFacility(record, placeId, index)

    if (row.colour === ROW_COLOUR.RED) {
        return { outcome: IMPORT_OUTCOME.SKIPPED, reason: 'red_reviewed_not_added', match, placeId, fill: {} }
    }

    if (match) {
        const { fill, conflicts } = planFill(record, match.facility)
        if (conflicts.length) {
            return { ...review(`conflicts_with_confirmed:${conflicts.join(',')}`, match, placeId), fill }
        }
        return { outcome: IMPORT_OUTCOME.MATCHED, reason: null, match, placeId, fill }
    }

    if (row.colour === ROW_COLOUR.GREEN) {
        return review('green_row_not_in_directory', null, placeId)
    }

    if (!record.prefectureEn || !record.nameJa || !record.nameEn) {
        return review(record.prefectureEn ? 'missing_name' : 'unknown_prefecture', null, placeId)
    }

    if (!placeId) {
        return review('reason' in found ? found.reason : 'no_place_found')
    }

    if (claimedPlaceIds.has(placeId)) {
        return review('duplicate_place_in_sheet', null, placeId)
    }

    return { outcome: IMPORT_OUTCOME.CREATED, reason: null, match: null, placeId, fill: {} }
}

/** UNVERIFIED with a city, UNVERIFIED_LOCATION without one (docs/city-rules.md). */
export function verificationStatusFor(record: InstitutionRecord): 'UNVERIFIED' | 'UNVERIFIED_LOCATION' {
    return record.city ? 'UNVERIFIED' : 'UNVERIFIED_LOCATION'
}
