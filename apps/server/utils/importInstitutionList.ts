import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { envVariables } from './environmentVariables.js'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'
import {
    IMPORT_OUTCOME,
    indexFacilities,
    isRowColour,
    parseInstitutionRow,
    placeQuery,
    planRow,
    verificationStatusFor,
    type ExistingFacility,
    type FacilityFill,
    type InstitutionRecord,
    type PlaceLookup,
    type RowPlan,
    type SheetRow
} from '../src/vocabulary/institutionList.js'
import { canonicalMapsLink } from '../src/places/mapsLink.js'
import { searchPlaceIds } from '../src/places/placesClient.js'
import type { Database } from '../src/typeDefs/kyselyTypes.js'

/**
 * Import the multilingual institutions spreadsheet (#21).
 *
 * 1. python3 utils/exportInstitutionList.py list.xlsx rows.json
 * 2. node --loader ts-node/esm utils/importInstitutionList.ts --input rows.json [--places] [--place-cache ids.json]
 *    [--report report.json]
 * 3. Read the summary and the report. Then add --write (and --confirm-production through pnpm db:prod).
 *
 * Dry-run is the default and writes nothing to the database. Every row is staged in
 * institution_import_rows with its raw columns, sheet, and row number. A matched facility only has
 * its empty fields filled. A new facility is UNVERIFIED (or UNVERIFIED_LOCATION without a city), has
 * source MHLW_MULTILINGUAL_INSTITUTIONS, and needs exactly one Places id from an id-only search.
 * No healthcare professional is created, and no payment or insurance is written: a moderator fills
 * those from the clinic (#20, #18). Rows already matched or created by an earlier run are left alone.
 *
 * `--places` calls Places Text Search for the id field only, which needs GOOGLE_API_KEY. Without it,
 * rows that need a place come back as `place_lookup_not_run`. `--place-cache` keeps the ids between
 * dry-runs so the next run does not ask again; a place id is the one Places value we may store.
 */

const SOURCE = 'MHLW_MULTILINGUAL_INSTITUTIONS'
const PLACES_CONCURRENCY = 5

type InputDocument = { sourceFile: string, rows: SheetRow[] }
type PlaceCache = Record<string, string[]>
type StagedRow = { outcome: string, facilityId: string | null, googlePlaceId: string | null }
type PlannedRow = { row: SheetRow, record: InstitutionRecord, plan: RowPlan, alreadyImported: boolean }

function print(line: string): void {
    process.stdout.write(`${line}\n`)
}

function argValue(argv: readonly string[], name: string): string | null {
    const at = argv.indexOf(name)
    const value = at >= 0 ? argv[at + 1] : undefined
    return value && !value.startsWith('--') ? value : null
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
        && Object.values(value as Record<string, unknown>).every(item => typeof item === 'string')
}

function toSheetRow(value: unknown): SheetRow {
    if (!value || typeof value !== 'object') {
        throw new Error('Each row must be an object.')
    }
    const row = value as Record<string, unknown>
    if (typeof row.sheet !== 'string' || !Number.isInteger(row.rowNumber) || !isRowColour(row.colour)
        || !isStringRecord(row.raw)) {
        throw new Error('Each row needs sheet, rowNumber, colour, and raw. Re-run exportInstitutionList.py.')
    }
    return { sheet: row.sheet, rowNumber: row.rowNumber as number, colour: row.colour, raw: row.raw }
}

export function readInput(path: string): InputDocument {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('The input is not an export document.')
    }
    const document = parsed as { sourceFile?: unknown, rows?: unknown }
    if (typeof document.sourceFile !== 'string' || !document.sourceFile.trim() || !Array.isArray(document.rows)) {
        throw new Error('The input needs sourceFile and rows. Re-run exportInstitutionList.py.')
    }
    return { sourceFile: document.sourceFile, rows: document.rows.map(toSheetRow) }
}

function rowKey(sourceFile: string, row: SheetRow): string {
    return `${sourceFile}#${row.sheet}#${row.rowNumber}`
}

function readCache(path: string | null): PlaceCache {
    if (!path || !existsSync(path)) {
        return {}
    }
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
    }
    const cache: PlaceCache = {}
    for (const [key, ids] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) {
            cache[key] = ids as string[]
        }
    }
    return cache
}

async function loadFacilities(db: Kysely<Database>): Promise<ExistingFacility[]> {
    const rows = await db.selectFrom('facilities')
        .select(['id', 'name_ja', 'contact', 'google_place_id', 'verification_status', 'supported_languages'])
        .execute()
    return rows.map(row => ({
        id: row.id,
        nameJa: row.name_ja,
        postalCode: row.contact?.address?.postalCode ?? '',
        phone: row.contact?.phone ?? '',
        website: row.contact?.website ?? '',
        googlePlaceId: row.google_place_id,
        googleMapsUrl: row.contact?.googleMapsUrl ?? '',
        verificationStatus: row.verification_status,
        supportedLanguages: Array.isArray(row.supported_languages) ? row.supported_languages : []
    }))
}

async function loadCityIds(db: Kysely<Database>): Promise<Map<string, string>> {
    const rows = await db.selectFrom('cities')
        .innerJoin('prefectures', 'prefectures.id', 'cities.prefecture_id')
        .select(['cities.id as id', 'cities.name_ja as nameJa', 'prefectures.name_en as prefectureEn'])
        .execute()
    return new Map(rows.map(row => [`${row.prefectureEn}|${row.nameJa}`, row.id]))
}

async function loadStaged(db: Kysely<Database>, sourceFile: string): Promise<Map<string, StagedRow>> {
    const rows = await db.selectFrom('institution_import_rows')
        .select(['sheet_name', 'row_number', 'outcome', 'facility_id', 'google_place_id'])
        .where('source_file', '=', sourceFile)
        .execute()
    return new Map(rows.map(row => [
        `${sourceFile}#${row.sheet_name}#${row.row_number}`,
        { outcome: row.outcome, facilityId: row.facility_id, googlePlaceId: row.google_place_id }
    ]))
}

/** Id-only lookups for the rows that need one, a few at a time. Failures are left unlooked-up. */
async function lookUpPlaces(
    keys: readonly { key: string, query: string }[],
    cache: PlaceCache,
    apiKey: string
): Promise<number> {
    let failed = 0
    const queue = keys.filter(item => !cache[item.key])
    for (let start = 0; start < queue.length; start += PLACES_CONCURRENCY) {
        const batch = queue.slice(start, start + PLACES_CONCURRENCY)
        await Promise.all(batch.map(async item => {
            try {
                cache[item.key] = await searchPlaceIds(item.query, apiKey)
            } catch (error) {
                failed += 1
                print(`places lookup failed for ${item.key}: ${error instanceof Error ? error.message : 'error'}`)
            }
        }))
    }
    return failed
}

function lookupFor(key: string, cache: PlaceCache, staged: StagedRow | undefined): PlaceLookup {
    if (cache[key]) {
        return { placeIds: cache[key] }
    }
    if (staged?.googlePlaceId) {
        return { placeIds: [staged.googlePlaceId] }
    }
    return null
}

/** Plan every row. A row an earlier write already matched or created keeps that result. */
export function planAll(
    input: InputDocument,
    facilities: readonly ExistingFacility[],
    cache: PlaceCache,
    staged: ReadonlyMap<string, StagedRow>
): PlannedRow[] {
    const index = indexFacilities(facilities)
    const claimed = new Set<string>()
    const planned: PlannedRow[] = []

    for (const row of input.rows) {
        const key = rowKey(input.sourceFile, row)
        const record = parseInstitutionRow(row)
        const previous = staged.get(key)
        const plan = planRow(row, record, lookupFor(key, cache, previous), index, claimed)
        const alreadyImported = previous?.outcome === IMPORT_OUTCOME.CREATED
            || previous?.outcome === IMPORT_OUTCOME.MATCHED
        if (plan.outcome === IMPORT_OUTCOME.CREATED && plan.placeId) {
            claimed.add(plan.placeId)
        }
        planned.push({ row, record, plan, alreadyImported })
    }
    return planned
}

function increment(counts: Record<string, number>, key: string): void {
    counts[key] = (counts[key] ?? 0) + 1
}

export function summarize(planned: readonly PlannedRow[]) {
    const byColour: Record<string, Record<string, number>> = {}
    const reasons: Record<string, number> = {}
    const warnings: Record<string, number> = {}
    const matchMethods: Record<string, number> = {}
    const fills: Record<string, number> = {}
    const created = { total: 0, withCity: 0, withoutCity: 0 }
    let alreadyImported = 0

    for (const { row, record, plan, alreadyImported: done } of planned) {
        // A row an earlier write matched or created is not planned again, so it is only counted here.
        if (done) {
            alreadyImported += 1
            continue
        }
        byColour[row.colour] ??= {}
        increment(byColour[row.colour] as Record<string, number>, plan.outcome)
        if (plan.reason) {
            increment(reasons, plan.reason.split(':')[0] ?? plan.reason)
        }
        if (plan.match) {
            increment(matchMethods, plan.match.method)
        }
        Object.keys(plan.fill).forEach(field => increment(fills, field))
        record.warnings.forEach(warning => increment(warnings, warning.split(':')[0] ?? warning))
        if (plan.outcome === IMPORT_OUTCOME.CREATED) {
            created.total += 1
            created[record.city ? 'withCity' : 'withoutCity'] += 1
        }
    }

    return { rows: planned.length, alreadyImported, byColour, created, matchMethods, fills, reasons, warnings }
}

function reportRows(planned: readonly PlannedRow[]) {
    return planned.map(({ row, record, plan }) => ({
        sheet: row.sheet,
        rowNumber: row.rowNumber,
        colour: row.colour,
        nameJa: record.nameJa,
        outcome: plan.outcome,
        reason: plan.reason,
        matchMethod: plan.match?.method ?? null,
        facilityId: plan.match?.facility.id ?? null,
        placeId: plan.placeId,
        city: record.city ? `${record.city.prefectureEn}/${record.city.nameEn}` : null,
        fill: Object.keys(plan.fill),
        warnings: record.warnings
    }))
}

function newContact(record: InstitutionRecord, placeId: string) {
    return {
        googleMapsUrl: canonicalMapsLink({ name: record.nameJa, latitude: null, longitude: null, placeId }) ?? '',
        email: '',
        phone: record.phone,
        website: record.website,
        address: {
            postalCode: record.postalCode,
            prefectureEn: record.prefectureEn ?? '',
            prefectureJa: record.prefectureJa,
            cityEn: record.city?.nameEn ?? '',
            cityJa: record.city?.nameJa ?? '',
            addressLine1En: record.addressLine1En,
            addressLine2En: '',
            addressLine1Ja: record.addressLine1Ja,
            addressLine2Ja: ''
        }
    }
}

async function createFacility(
    db: Kysely<Database>,
    record: InstitutionRecord,
    placeId: string,
    cityIds: ReadonlyMap<string, string>
): Promise<string> {
    const cityId = record.city ? cityIds.get(`${record.city.prefectureEn}|${record.city.nameJa}`) ?? null : null
    const now = new Date().toISOString()
    const inserted = await db.insertInto('facilities')
        .values({
            name_en: record.nameEn,
            name_ja: record.nameJa,
            contact: newContact(record, placeId),
            map_latitude: null,
            map_longitude: null,
            payment_options: '[]',
            city_id: cityId,
            google_place_id: placeId,
            source: SOURCE,
            verification_status: cityId ? verificationStatusFor(record) : 'UNVERIFIED_LOCATION',
            supported_languages: JSON.stringify(record.languages),
            japanese_insurance: null,
            online: false,
            created_date: now,
            updated_date: now,
            code: null,
            firestore_id: null
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    return inserted.id
}

/** Write the fill onto the facility, still only where the field is empty when the update runs. */
async function fillFacility(db: Kysely<Database>, facilityId: string, fill: FacilityFill): Promise<void> {
    if (fill.phone) {
        await sql`update facilities set contact = jsonb_set(contact, '{phone}', to_jsonb(${fill.phone}::text), true),
            updated_date = now()
            where id = ${facilityId} and coalesce(btrim(contact ->> 'phone'), '') = ''`.execute(db)
    }
    if (fill.website) {
        await sql`update facilities set contact = jsonb_set(contact, '{website}', to_jsonb(${fill.website}::text), true),
            updated_date = now()
            where id = ${facilityId} and coalesce(btrim(contact ->> 'website'), '') = ''`.execute(db)
    }
    if (fill.postalCode) {
        await sql`update facilities
            set contact = jsonb_set(contact, '{address,postalCode}', to_jsonb(${fill.postalCode}::text), false),
            updated_date = now()
            where id = ${facilityId} and contact ? 'address'
              and coalesce(btrim(contact #>> '{address,postalCode}'), '') = ''`.execute(db)
    }
    if (fill.supportedLanguages) {
        await db.updateTable('facilities')
            .set({ supported_languages: JSON.stringify(fill.supportedLanguages), updated_date: new Date().toISOString() })
            .where('id', '=', facilityId)
            .where(sql<boolean>`jsonb_array_length(supported_languages) = 0`)
            .execute()
    }
}

async function writeRow(
    db: Kysely<Database>,
    sourceFile: string,
    item: PlannedRow,
    cityIds: ReadonlyMap<string, string>
): Promise<void> {
    const { row, record, plan } = item
    await db.transaction().execute(async transaction => {
        let facilityId = plan.match?.facility.id ?? null
        if (plan.outcome === IMPORT_OUTCOME.CREATED && plan.placeId) {
            facilityId = await createFacility(transaction, record, plan.placeId, cityIds)
        } else if (facilityId && plan.outcome !== IMPORT_OUTCOME.SKIPPED && Object.keys(plan.fill).length) {
            await fillFacility(transaction, facilityId, plan.fill)
        }

        const values = {
            colour: row.colour,
            raw: JSON.stringify(row.raw),
            outcome: plan.outcome,
            reason: plan.reason,
            match_method: plan.match?.method ?? null,
            facility_id: facilityId,
            google_place_id: plan.placeId,
            warnings: JSON.stringify(record.warnings)
        }
        await transaction.insertInto('institution_import_rows')
            .values({ source_file: sourceFile, sheet_name: row.sheet, row_number: row.rowNumber, ...values })
            .onConflict(conflict => conflict
                .columns(['source_file', 'sheet_name', 'row_number'])
                .doUpdateSet({ ...values, updated_at: sql`now()` }))
            .execute()
    })
}

export async function main(argv: readonly string[] = process.argv) {
    const write = argv.includes('--write')
    const inputPath = argValue(argv, '--input')
    if (!inputPath) {
        throw new Error('Pass --input rows.json from utils/exportInstitutionList.py.')
    }

    assertScriptWriteAllowed(write, argv)
    print(describeScriptTarget(write))

    const input = readInput(inputPath)
    const cachePath = argValue(argv, '--place-cache')
    const cache = readCache(cachePath)
    const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool(scriptDatabaseConfig()) }) })

    try {
        const [facilities, cityIds, staged] = await Promise.all([
            loadFacilities(db),
            loadCityIds(db),
            loadStaged(db, input.sourceFile)
        ])

        if (argv.includes('--places')) {
            const apiKey = envVariables.googleAPIKey()
            if (!apiKey) {
                throw new Error('--places needs GOOGLE_API_KEY.')
            }
            const wanted = input.rows
                .filter(row => !staged.get(rowKey(input.sourceFile, row))?.googlePlaceId)
                .map(row => ({ key: rowKey(input.sourceFile, row), query: placeQuery(parseInstitutionRow(row)) }))
            const failed = await lookUpPlaces(wanted, cache, apiKey)
            print(`places lookups: ${wanted.length} wanted, ${failed} failed`)
            if (cachePath) {
                writeFileSync(cachePath, JSON.stringify(cache, null, 1))
            }
        }

        const planned = planAll(input, facilities, cache, staged)
        const summary = summarize(planned)
        print(JSON.stringify({ write, sourceFile: input.sourceFile, ...summary }, null, 2))

        const reportPath = argValue(argv, '--report')
        if (reportPath) {
            writeFileSync(reportPath, JSON.stringify(reportRows(planned), null, 1))
            print(`report: ${reportPath}`)
        }

        if (!write) {
            print('Dry-run only. Re-run with --write to stage rows, fill empty fields, and create facilities.')
            return summary
        }

        let written = 0
        for (const item of planned) {
            if (item.alreadyImported) {
                continue
            }
            await writeRow(db, input.sourceFile, item, cityIds)
            written += 1
        }
        print(`written: ${written} rows`)
        return summary
    } finally {
        await db.destroy()
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        process.stderr.write(`importInstitutionList failed: ${error instanceof Error ? error.message : 'unknown'}\n`)
        process.exitCode = 1
    })
}
