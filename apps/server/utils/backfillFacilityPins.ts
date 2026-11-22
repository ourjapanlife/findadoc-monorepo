import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { parse } from 'csv-parse/sync'
import { hasUsableMapPin } from '@findadoc/utils'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'

/**
 * Fill the map pins the #21 import left empty, from the Ministry of Health's open data (#21).
 *
 * The import stored only a Place ID, so 1,249 in-person facilities had no coordinates and the
 * search map drew them in central Tokyo. Places coordinates may be kept for 30 days at most
 * (docs/places-storage.md), so they are not the source. The ministry publishes every hospital
 * and clinic with its coordinates (医療情報ネット open data, 公共データ利用規約 PDL1.0), and the
 * clinic page credits it for imported facilities.
 *
 * Inputs are the unzipped facility CSVs from
 * https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/newpage_43373.html
 * (病院・診療所・歯科診療所の施設票), passed as `--csv <file>` once per file.
 *
 * A facility is filled when exactly one ministry row matches it:
 * - `name_and_address`: same Japanese name in the same municipality, and the same street address.
 *   Filled automatically.
 * - `name_only` or `address_only`: one of the two agrees. Filled only when the facility id is
 *   approved in `--approved <verification csv>`, a row whose `check_map_pin_place` says ok.
 * With `--geocode`, the facility's own Japanese street address is also looked up in the Geospatial
 * Information Authority's address search (国土地理院). The result is used only when it names the
 * block (番 or 号), and then:
 * - a one-sided ministry match is filled with the ministry pin when the address lands within
 *   150 m of it, so the address confirms what a person would otherwise approve;
 * - a facility with no ministry row, or a ministry row at 0,0, gets the address pin.
 * A one-sided match the address does not confirm, and an address found only to the town or
 * 丁目, are left for a moderator. Only rows that still have no pin are written, and the write is
 * a compare-and-set on the empty pin.
 *
 * Dry-run unless `--write` is passed. Reports counts and ids only.
 */

/** One ministry row. About 6% have 0,0 for coordinates: they still match, but give no pin. */
export type MinistryInstitution = { id: string, name: string, address: string, lat: number, lng: number }

export type PinlessFacility = {
    id: string
    nameJa: string
    prefectureJa: string
    cityJa: string
    addressLine1Ja: string
}

export const MATCH_LEVEL = {
    NameAndAddress: 'name_and_address',
    NameOnly: 'name_only',
    AddressOnly: 'address_only',
    None: 'none'
} as const

export type MatchLevel = typeof MATCH_LEVEL[keyof typeof MATCH_LEVEL]

export type PinMatch = {
    facilityId: string
    level: MatchLevel
    institution?: MinistryInstitution
    // The facility's own street address, for the address lookup.
    street: string
}

const KANJI_DIGITS = '〇一二三四五六七八九'

/** Width-folded with spaces and dashes removed, so 「中央クリニック」 and 「中央 クリニック」 agree. */
export function normalizeJapanese(value: string): string {
    return value.normalize('NFKC').replace(/[\s　・･\-‐ー－−]/g, '')
}

/**
 * The street address down to its last number, with each number kept apart: 「基町10番52号 テストビル2階」
 * and 「基町１０－５２」 both become 「基町10-52」, while 「1-23」 and 「12-3」 stay different. A space
 * after a number starts the building, and a trailing floor (2階, 3F) is dropped: building names
 * differ too often to compare.
 */
export function addressKey(value: string): string {
    const width = value.normalize('NFKC').replace(/[‐－−]/g, '-')
    const buildingStart = width.search(/\d\s/)
    const street = buildingStart === -1 ? width : width.slice(0, buildingStart + 1)
    return street
        .replace(/[\s　・･]/g, '')
        .replace(/\d+(階|F)$/, '')
        .replace(/丁目|番地|番|号/g, '-')
        .replace(/[〇一二三四五六七八九]/g, digit => String(KANJI_DIGITS.indexOf(digit)))
        .replace(/[^0-9]*$/, '')
        .replace(/-+/g, '-')
}

/** The same street address: every number has to agree, so 10-5 is not 10-52. */
function sameStreet(left: string, right: string): boolean {
    return left !== '' && left === right
}

function pushTo<T>(index: Map<string, T[]>, key: string, value: T): void {
    if (!key) {
        return
    }
    const list = index.get(key)
    if (list) {
        list.push(value)
    } else {
        index.set(key, [value])
    }
}

/**
 * The facility's prefecture, city, and street, width-folded and cut before the building, so the
 * address lookup gets 「広島県広島市中区基町10-52」 and not the floor of a tenant building.
 */
export function streetQuery(facility: PinlessFacility): string {
    const width = `${facility.prefectureJa}${facility.cityJa}${facility.addressLine1Ja}`.normalize('NFKC')
    const buildingStart = width.search(/\d\s/)
    return (buildingStart === -1 ? width : width.slice(0, buildingStart + 1)).replace(/[\s　]/g, '')
}

/** Matches each facility to at most one ministry institution. */
export function matchFacilityPins(
    facilities: readonly PinlessFacility[],
    institutions: readonly MinistryInstitution[]
): PinMatch[] {
    const byName = new Map<string, MinistryInstitution[]>()
    const byAddress = new Map<string, MinistryInstitution[]>()
    for (const institution of institutions) {
        pushTo(byName, normalizeJapanese(institution.name), institution)
        pushTo(byAddress, addressKey(institution.address), institution)
    }

    return facilities.map(facility => {
        const street = streetQuery(facility)
        const ours = addressKey(street)
        const city = normalizeJapanese(`${facility.prefectureJa}${facility.cityJa}`)
        const sameName = (byName.get(normalizeJapanese(facility.nameJa)) ?? [])
            .filter(institution => city && normalizeJapanese(institution.address).startsWith(city))
        const [named] = sameName

        if (sameName.length === 1 && named) {
            const level = sameStreet(ours, addressKey(named.address))
                ? MATCH_LEVEL.NameAndAddress
                : MATCH_LEVEL.NameOnly
            return { facilityId: facility.id, level, institution: named, street }
        }

        const sameAddress = sameName.length === 0 ? byAddress.get(ours) ?? [] : []
        const [located] = sameAddress
        if (sameAddress.length === 1 && located) {
            return { facilityId: facility.id, level: MATCH_LEVEL.AddressOnly, institution: located, street }
        }

        return { facilityId: facility.id, level: MATCH_LEVEL.None, street }
    })
}

const ID_COLUMN = 'ID'
const NAME_COLUMN = '正式名称'
const ADDRESS_COLUMN = '所在地'
const LATITUDE_COLUMN = '所在地座標（緯度）'
const LONGITUDE_COLUMN = '所在地座標（経度）'
const MINISTRY_COLUMNS = [ID_COLUMN, NAME_COLUMN, ADDRESS_COLUMN, LATITUDE_COLUMN, LONGITUDE_COLUMN]
const APPROVAL_COLUMNS = ['id', 'check_map_pin_place']

/**
 * Parses a CSV with a header row and refuses one that lacks a required column, so a wrong file
 * fails before anything is planned instead of reading as rows with no pin or no approval.
 */
function parseCsvRows(text: string, required: readonly string[], label: string): Record<string, string>[] {
    const parsed: unknown = parse(text, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true })
    if (!Array.isArray(parsed)) {
        throw new Error(`The ${label} could not be read.`)
    }
    const rows = parsed.filter((row): row is Record<string, string> => typeof row === 'object' && row !== null)
    const [first] = rows
    const missing = first ? required.filter(column => !(column in first)) : []
    if (missing.length > 0) {
        throw new Error(`The ${label} has no ${missing.join(', ')} column.`)
    }
    return rows
}

/**
 * Reads one ministry facility CSV. Rows without usable coordinates stay, so that a facility
 * matches its own row and not another branch with the same name; they are never written.
 */
export function parseMinistryCsv(text: string): MinistryInstitution[] {
    const rows = parseCsvRows(text, MINISTRY_COLUMNS, 'ministry CSV')

    return rows.map(row => ({
        id: row[ID_COLUMN] ?? '',
        name: row[NAME_COLUMN] ?? '',
        address: row[ADDRESS_COLUMN] ?? '',
        lat: Number(row[LATITUDE_COLUMN]),
        lng: Number(row[LONGITUDE_COLUMN])
    }))
}

/** True when the matched ministry row has coordinates we can use. */
export function hasMinistryPin(match: PinMatch): boolean {
    return match.institution !== undefined && hasUsableMapPin(match.institution.lat, match.institution.lng)
}

const APPROVED_VALUES = new Set(['ok', 'yes', 'y', 'approved', '✓', '✔'])

/** Facility ids a person approved in the verification CSV (`check_map_pin_place`). */
export function parseApprovedIds(text: string): Set<string> {
    const rows = parseCsvRows(text, APPROVAL_COLUMNS, 'verification CSV')

    return new Set(rows
        .filter(row => APPROVED_VALUES.has((row.check_map_pin_place ?? '').trim().toLowerCase()))
        .map(row => (row.id ?? '').trim())
        .filter(id => id !== ''))
}

/** Whether a match is written: its row has a pin, and both agree or a person approved it. */
export function shouldFill(match: PinMatch, approved: ReadonlySet<string>): boolean {
    if (!hasMinistryPin(match)) {
        return false
    }
    return match.level === MATCH_LEVEL.NameAndAddress || approved.has(match.facilityId)
}

export const ADDRESS_PRECISION = {
    Block: 'block',
    Chome: 'chome',
    Town: 'town'
} as const

export type AddressPrecision = typeof ADDRESS_PRECISION[keyof typeof ADDRESS_PRECISION]

/** Where the address lookup put a street address, and how far down the address it got. */
export type AddressPin = { lat: number, lng: number, precision: AddressPrecision }

export type Geocoder = (street: string) => Promise<AddressPin | null>

/** How far the address search's matched address goes: to the block (番, 号), the 丁目, or the town. */
export function addressPrecision(matched: string): AddressPrecision {
    const value = matched.normalize('NFKC')
    if (/[番号]$|\d$/.test(value)) {
        return ADDRESS_PRECISION.Block
    }
    return /丁目$/.test(value) ? ADDRESS_PRECISION.Chome : ADDRESS_PRECISION.Town
}

const EARTH_RADIUS_METERS = 6371000

/** Great-circle distance in meters. */
export function distanceMeters(from: { lat: number, lng: number }, to: { lat: number, lng: number }): number {
    const rad = Math.PI / 180
    const a = Math.sin((to.lat - from.lat) * rad / 2) ** 2
        + Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin((to.lng - from.lng) * rad / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}

/** A one-sided ministry pin is confirmed when the street address lands this close to it. */
export const ADDRESS_CONFIRM_METERS = 150

export const PIN_SOURCE = {
    Ministry: 'ministry',
    MinistryConfirmedByAddress: 'ministry_confirmed_by_address',
    Address: 'address'
} as const

export type PinSource = typeof PIN_SOURCE[keyof typeof PIN_SOURCE]

export type PinFill = { facilityId: string, lat: number, lng: number, source: PinSource }

/**
 * The pin to write for a match, or null to leave it for a moderator. The ministry pin wins when
 * both sides agree or a person approved it. Otherwise a block-level address either confirms a
 * one-sided ministry pin within 150 m, or stands in when the ministry has no pin at all. An
 * address that disagrees with the ministry is not used: a person decides which one is right.
 */
export function planFill(match: PinMatch, approved: ReadonlySet<string>, address?: AddressPin | null): PinFill | null {
    const institution = match.institution
    if (institution && shouldFill(match, approved)) {
        return { facilityId: match.facilityId, lat: institution.lat, lng: institution.lng, source: PIN_SOURCE.Ministry }
    }
    if (!address || address.precision !== ADDRESS_PRECISION.Block || !hasUsableMapPin(address.lat, address.lng)) {
        return null
    }
    if (institution && hasMinistryPin(match)) {
        if (distanceMeters(institution, address) > ADDRESS_CONFIRM_METERS) {
            return null
        }
        return {
            facilityId: match.facilityId,
            lat: institution.lat,
            lng: institution.lng,
            source: PIN_SOURCE.MinistryConfirmedByAddress
        }
    }
    return { facilityId: match.facilityId, lat: address.lat, lng: address.lng, source: PIN_SOURCE.Address }
}

const GSI_ADDRESS_SEARCH_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch'
const GSI_DELAY_MS = 250

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

/** Reads the first feature of a GSI address search response, or null when there is none. */
export function parseGsiResponse(body: unknown): AddressPin | null {
    const [first] = Array.isArray(body) ? body : []
    const geometry = isRecord(first) ? first.geometry : undefined
    const properties = isRecord(first) ? first.properties : undefined
    const coordinates = isRecord(geometry) ? geometry.coordinates : undefined
    const title = isRecord(properties) ? properties.title : undefined
    if (!Array.isArray(coordinates) || typeof title !== 'string') {
        return null
    }
    const [lng, lat] = coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null
    }
    return { lat, lng, precision: addressPrecision(title) }
}

/**
 * Looks up street addresses in GSI's address search, one at a time with a pause between calls.
 * Only a clinic's public street address is sent, never anything about a patient.
 */
export function createGsiGeocoder(fetchImpl: typeof fetch = fetch, delayMs = GSI_DELAY_MS): Geocoder {
    return async street => {
        const response = await fetchImpl(`${GSI_ADDRESS_SEARCH_URL}?q=${encodeURIComponent(street)}`)
        if (!response.ok) {
            throw new Error(`GSI address search returned HTTP ${response.status}`)
        }
        const pin = parseGsiResponse(await response.json())
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return pin
    }
}

/** Looks up each match that nothing else fills. A failed lookup leaves that facility for later. */
async function lookUpAddresses(
    matches: readonly PinMatch[],
    approved: ReadonlySet<string>,
    geocode: Geocoder
): Promise<{ addresses: Map<string, AddressPin | null>, lookups: number, failures: number }> {
    const addresses = new Map<string, AddressPin | null>()
    let lookups = 0
    let failures = 0
    for (const match of matches) {
        if (shouldFill(match, approved) || match.street === '') {
            continue
        }
        lookups += 1
        try {
            addresses.set(match.facilityId, await geocode(match.street))
        } catch {
            failures += 1
        }
    }
    return { addresses, lookups, failures }
}

export type FacilityPinsReport = {
    write: boolean
    ministryRows: number
    pinless: number
    byLevel: Record<MatchLevel, number>
    // Matched a ministry row whose coordinates are 0,0, so a moderator places the pin.
    matchedWithoutMinistryPin: number
    approvedInCsv: number
    // With --geocode: street addresses looked up, and lookups that failed and were left alone.
    addressLookups: number
    addressLookupFailures: number
    bySource: Record<PinSource, number>
    toFill: number
    sampleIds: string[]
    updated: number
}

type FacilityRow = {
    id: string
    name_ja: string
    prefecture_ja: string | null
    city_ja: string | null
    address_line1_ja: string | null
}

const SAMPLE_SIZE = 5

/**
 * Plans and, with `write`, fills the pins on an open connection. Without `geocode`, only ministry
 * pins are planned, as before.
 */
export async function backfillFacilityPins(
    client: pg.ClientBase,
    institutions: readonly MinistryInstitution[],
    approved: ReadonlySet<string>,
    write: boolean,
    geocode?: Geocoder
): Promise<FacilityPinsReport> {
    const result = await client.query<FacilityRow>(`
        select id, name_ja,
               contact->'address'->>'prefectureJa' as prefecture_ja,
               contact->'address'->>'cityJa' as city_ja,
               contact->'address'->>'addressLine1Ja' as address_line1_ja
        from facilities
        where online = false
          and (map_latitude is null or map_longitude is null or map_latitude = 0 or map_longitude = 0)
        order by created_date
    `)
    const facilities = result.rows.map(row => ({
        id: row.id,
        nameJa: row.name_ja,
        prefectureJa: row.prefecture_ja ?? '',
        cityJa: row.city_ja ?? '',
        addressLine1Ja: row.address_line1_ja ?? ''
    }))

    const matches = matchFacilityPins(facilities, institutions)
    const lookup = geocode
        ? await lookUpAddresses(matches, approved, geocode)
        : { addresses: new Map<string, AddressPin | null>(), lookups: 0, failures: 0 }
    const fills = matches
        .map(match => planFill(match, approved, lookup.addresses.get(match.facilityId)))
        .filter((fill): fill is PinFill => fill !== null)
    const byLevel: Record<MatchLevel, number> = { name_and_address: 0, name_only: 0, address_only: 0, none: 0 }
    for (const match of matches) {
        byLevel[match.level] += 1
    }
    const bySource: Record<PinSource, number> = { ministry: 0, ministry_confirmed_by_address: 0, address: 0 }
    for (const fill of fills) {
        bySource[fill.source] += 1
    }

    const report: FacilityPinsReport = {
        write,
        ministryRows: institutions.length,
        pinless: facilities.length,
        byLevel,
        matchedWithoutMinistryPin: matches.filter(match => match.institution && !hasMinistryPin(match)).length,
        approvedInCsv: matches.filter(match => match.level !== MATCH_LEVEL.NameAndAddress
            && hasMinistryPin(match) && approved.has(match.facilityId)).length,
        addressLookups: lookup.lookups,
        addressLookupFailures: lookup.failures,
        bySource,
        toFill: fills.length,
        sampleIds: fills.slice(0, SAMPLE_SIZE).map(fill => fill.facilityId),
        updated: 0
    }

    if (write && fills.length > 0) {
        await client.query('begin')
        try {
            for (const fill of fills) {
                // Compare-and-set: a pin a moderator saved since the dry-run stays.
                const update = await client.query(`
                    update facilities
                    set map_latitude = $1, map_longitude = $2, updated_date = now()
                    where id = $3 and online = false
                      and (map_latitude is null or map_longitude is null or map_latitude = 0 or map_longitude = 0)
                `, [fill.lat, fill.lng, fill.facilityId])
                report.updated += update.rowCount ?? 0
            }
            await client.query('commit')
        } catch (error) {
            await client.query('rollback')
            throw error
        }
    }

    return report
}

function argValues(argv: readonly string[], flag: string): string[] {
    return argv.flatMap((value, index) => {
        const next = argv[index + 1]
        return value === flag && next !== undefined ? [next] : []
    })
}

export async function main(argv: readonly string[] = process.argv): Promise<void> {
    const write = argv.includes('--write')
    assertScriptWriteAllowed(write, argv)
    const csvFiles = argValues(argv, '--csv')
    if (csvFiles.length === 0) {
        // eslint-disable-next-line no-console -- CLI usage
        console.error('Pass the ministry facility CSVs with --csv <file>, once per file.')
        process.exitCode = 1
        return
    }
    let institutions: MinistryInstitution[]
    let approved: Set<string>
    try {
        institutions = csvFiles.flatMap(file => parseMinistryCsv(readFileSync(file, 'utf8')))
        const approvedFile = argValues(argv, '--approved')[0]
        approved = approvedFile ? parseApprovedIds(readFileSync(approvedFile, 'utf8')) : new Set<string>()
    } catch (error) {
        // The message names a file problem or a missing column, never a row value.
        // eslint-disable-next-line no-console -- CLI usage
        console.error(error instanceof Error ? error.message : 'The CSV files could not be read.')
        process.exitCode = 1
        return
    }

    // eslint-disable-next-line no-console -- a CLI report of the target, like the other backfills
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    try {
        const geocode = argv.includes('--geocode') ? createGsiGeocoder() : undefined
        const report = await backfillFacilityPins(client, institutions, approved, write, geocode)
        // eslint-disable-next-line no-console -- counts and ids only
        console.log(JSON.stringify(report, null, 2))
        if (!write && report.toFill > 0) {
            // eslint-disable-next-line no-console -- CLI hint for the operator
            console.log('Dry-run only. Re-run with --write to fill these pins.')
        }
    } finally {
        await client.end()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        // eslint-disable-next-line no-console -- the error name only; a database error can repeat row values
        console.error(`backfillFacilityPins failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
