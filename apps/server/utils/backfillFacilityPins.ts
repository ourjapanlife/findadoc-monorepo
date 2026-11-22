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
 * Anything else is left for a moderator. Only rows that still have no pin are written, and the
 * write is a compare-and-set on the empty pin.
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

export type PinMatch = { facilityId: string, level: MatchLevel, institution?: MinistryInstitution }

const KANJI_DIGITS = '〇一二三四五六七八九'

/** Width-folded with spaces and dashes removed, so 「中央クリニック」 and 「中央 クリニック」 agree. */
export function normalizeJapanese(value: string): string {
    return value.normalize('NFKC').replace(/[\s　・･\-‐ー－−]/g, '')
}

/**
 * The street address down to its last number, as digits: 「基町10番52号 テストビル2階」 and
 * 「基町１０－５２」 both become 「基町1052」. A space after a number starts the building, and a
 * trailing floor (2階, 3F) is dropped: building names differ too often to compare.
 */
export function addressKey(value: string): string {
    const width = value.normalize('NFKC')
    const buildingStart = width.search(/\d\s/)
    const street = buildingStart === -1 ? width : width.slice(0, buildingStart + 1)
    const folded = normalizeJapanese(street)
        .replace(/\d+(階|F)$/, '')
        .replace(/丁目|番地|番|号/g, '-')
        .replace(/[〇一二三四五六七八九]/g, digit => String(KANJI_DIGITS.indexOf(digit)))
    return folded.replace(/[^0-9]*$/, '').replace(/-/g, '')
}

function sameStreet(left: string, right: string): boolean {
    if (!left || !right) {
        return false
    }
    return left.startsWith(right) || right.startsWith(left)
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
        const ours = addressKey(`${facility.prefectureJa}${facility.cityJa}${facility.addressLine1Ja}`)
        const city = normalizeJapanese(`${facility.prefectureJa}${facility.cityJa}`)
        const sameName = (byName.get(normalizeJapanese(facility.nameJa)) ?? [])
            .filter(institution => city && normalizeJapanese(institution.address).startsWith(city))
        const [named] = sameName

        if (sameName.length === 1 && named) {
            const level = sameStreet(ours, addressKey(named.address))
                ? MATCH_LEVEL.NameAndAddress
                : MATCH_LEVEL.NameOnly
            return { facilityId: facility.id, level, institution: named }
        }

        const sameAddress = sameName.length === 0 ? byAddress.get(ours) ?? [] : []
        const [located] = sameAddress
        if (sameAddress.length === 1 && located) {
            return { facilityId: facility.id, level: MATCH_LEVEL.AddressOnly, institution: located }
        }

        return { facilityId: facility.id, level: MATCH_LEVEL.None }
    })
}

const ID_COLUMN = 'ID'
const NAME_COLUMN = '正式名称'
const ADDRESS_COLUMN = '所在地'
const LATITUDE_COLUMN = '所在地座標（緯度）'
const LONGITUDE_COLUMN = '所在地座標（経度）'

/**
 * Reads one ministry facility CSV. Rows without usable coordinates stay, so that a facility
 * matches its own row and not another branch with the same name; they are never written.
 */
export function parseMinistryCsv(text: string): MinistryInstitution[] {
    const rows = parse(text, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true }) as
        Record<string, string | undefined>[]

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
    const rows = parse(text, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string | undefined>[]

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

export type FacilityPinsReport = {
    write: boolean
    ministryRows: number
    pinless: number
    byLevel: Record<MatchLevel, number>
    // Matched a ministry row whose coordinates are 0,0, so a moderator places the pin.
    matchedWithoutMinistryPin: number
    approvedInCsv: number
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

/** Plans and, with `write`, fills the pins on an open connection. */
export async function backfillFacilityPins(
    client: pg.ClientBase,
    institutions: readonly MinistryInstitution[],
    approved: ReadonlySet<string>,
    write: boolean
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
    const fills = matches.filter(match => shouldFill(match, approved))
    const byLevel: Record<MatchLevel, number> = { name_and_address: 0, name_only: 0, address_only: 0, none: 0 }
    for (const match of matches) {
        byLevel[match.level] += 1
    }

    const report: FacilityPinsReport = {
        write,
        ministryRows: institutions.length,
        pinless: facilities.length,
        byLevel,
        matchedWithoutMinistryPin: matches.filter(match => match.institution && !hasMinistryPin(match)).length,
        approvedInCsv: matches.filter(match => match.level !== MATCH_LEVEL.NameAndAddress
            && hasMinistryPin(match) && approved.has(match.facilityId)).length,
        toFill: fills.length,
        sampleIds: fills.slice(0, SAMPLE_SIZE).map(match => match.facilityId),
        updated: 0
    }

    if (write && fills.length > 0) {
        await client.query('begin')
        try {
            for (const match of fills) {
                const institution = match.institution
                if (!institution) {
                    continue
                }
                // Compare-and-set: a pin a moderator saved since the dry-run stays.
                const update = await client.query(`
                    update facilities
                    set map_latitude = $1, map_longitude = $2, updated_date = now()
                    where id = $3 and online = false
                      and (map_latitude is null or map_longitude is null or map_latitude = 0 or map_longitude = 0)
                `, [institution.lat, institution.lng, match.facilityId])
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
    const institutions = csvFiles.flatMap(file => parseMinistryCsv(readFileSync(file, 'utf8')))
    const approvedFile = argValues(argv, '--approved')[0]
    const approved = approvedFile ? parseApprovedIds(readFileSync(approvedFile, 'utf8')) : new Set<string>()

    // eslint-disable-next-line no-console -- a CLI report of the target, like the other backfills
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    try {
        const report = await backfillFacilityPins(client, institutions, approved, write)
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
