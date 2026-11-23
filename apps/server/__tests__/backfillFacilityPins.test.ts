import { fileURLToPath } from 'node:url'
import type pg from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    ADDRESS_PRECISION,
    addressKey,
    addressPrecision,
    backfillFacilityPins,
    createGsiGeocoder,
    main,
    MATCH_LEVEL,
    matchFacilityPins,
    parseApprovedIds,
    parseGsiResponse,
    parseMinistryCsv,
    PIN_SOURCE,
    planClosestFill,
    planFill,
    shouldFill,
    streetQuery,
    type AddressPin,
    type MinistryInstitution,
    type PinlessFacility
} from '../utils/backfillFacilityPins.js'

const CA_BUNDLE = fileURLToPath(new URL('../certs/rds-ap-northeast-1-bundle.pem', import.meta.url))

// Fake institutions and facilities; the names and addresses are made up.
const HOSPITAL: MinistryInstitution = {
    id: 'M1', name: 'テスト中央病院', address: '広島県広島市中区基町１０番５２号', lat: 34.3963, lng: 132.4596
}
const BRANCH: MinistryInstitution = {
    id: 'M2', name: 'テスト中央病院', address: '広島県福山市東桜町３番５号', lat: 34.4858, lng: 133.3623
}
const RENAMED: MinistryInstitution = {
    id: 'M3', name: '医療法人社団テスト会 みどりクリニック', address: '広島県呉市中央４丁目１番６号', lat: 34.2492, lng: 132.5658
}
const NO_PIN: MinistryInstitution = {
    id: 'M4', name: 'テスト歯科医院', address: '広島県三原市城町１丁目２番１号', lat: 0, lng: 0
}
const INSTITUTIONS = [HOSPITAL, BRANCH, RENAMED, NO_PIN]

function facility(id: string, nameJa: string, cityJa: string, addressLine1Ja: string): PinlessFacility {
    return { id, nameJa, prefectureJa: '広島県', cityJa, addressLine1Ja }
}

describe('addressKey', () => {
    it('compares street numbers written in any style and ignores the building', () => {
        expect(addressKey('広島県広島市中区基町１０番５２号'))
            .toBe(addressKey('広島県広島市中区基町10-52 テストビル2階'))
    })

    it('keeps each street number apart, so 1-23 is not 12-3', () => {
        expect(addressKey('中区基町1-23')).not.toBe(addressKey('中区基町12-3'))
    })

    it('keeps a katakana long vowel in a town name', () => {
        expect(addressKey('テストニュータウン1-2')).toBe('テストニュータウン1-2')
    })
})

describe('matchFacilityPins', () => {
    it('matches the same name in the same city, not a branch elsewhere, and checks the street', () => {
        const [match] = matchFacilityPins([facility('f1', 'テスト中央病院', '広島市', '中区基町10-52')], INSTITUTIONS)

        expect(match?.level).toBe(MATCH_LEVEL.NameAndAddress)
        expect(match?.institution?.id).toBe('M1')
    })

    it('needs every street number to agree: 10-5 is not 10-52', () => {
        const [match] = matchFacilityPins([facility('f6', 'テスト中央病院', '広島市', '中区基町10-5')], INSTITUTIONS)

        expect(match?.level).toBe(MATCH_LEVEL.NameOnly)
    })

    it('marks a name match with a different street as name only', () => {
        const [match] = matchFacilityPins([facility('f2', 'テスト中央病院', '広島市', '中区大手町1-1')], INSTITUTIONS)

        expect(match?.level).toBe(MATCH_LEVEL.NameOnly)
    })

    it('falls back to a unique street address when the legal name differs', () => {
        const [match] = matchFacilityPins([facility('f3', 'みどりクリニック', '呉市', '中央4-1-6')], INSTITUTIONS)

        expect(match?.level).toBe(MATCH_LEVEL.AddressOnly)
        expect(match?.institution?.id).toBe('M3')
    })

    it('leaves a facility with no ministry row unmatched', () => {
        const [match] = matchFacilityPins([facility('f4', '存在しない医院', '尾道市', '土堂1-1')], INSTITUTIONS)

        expect(match?.level).toBe(MATCH_LEVEL.None)
        expect(match?.institution).toBeUndefined()
    })
})

describe('shouldFill', () => {
    const [both, nameOnly, addressOnly, noPin] = matchFacilityPins([
        facility('f1', 'テスト中央病院', '広島市', '中区基町10-52'),
        facility('f2', 'テスト中央病院', '広島市', '中区大手町1-1'),
        facility('f3', 'みどりクリニック', '呉市', '中央4-1-6'),
        facility('f5', 'テスト歯科医院', '三原市', '城町1-2-1')
    ], INSTITUTIONS)

    it('fills a match where the name and the address agree', () => {
        expect(both && shouldFill(both, new Set())).toBe(true)
    })

    it('fills a one-sided match only after a person approved it', () => {
        expect(nameOnly && shouldFill(nameOnly, new Set())).toBe(false)
        expect(addressOnly && shouldFill(addressOnly, new Set(['f3']))).toBe(true)
    })

    it('never writes a ministry row whose coordinates are 0,0', () => {
        expect(noPin?.level).toBe(MATCH_LEVEL.NameAndAddress)
        expect(noPin && shouldFill(noPin, new Set(['f5']))).toBe(false)
    })
})

describe('streetQuery', () => {
    it('sends the street without the building or floor', () => {
        expect(streetQuery(facility('f1', 'テスト中央病院', '広島市', '中区基町１０－５２ テストビル2階')))
            .toBe('広島県広島市中区基町10-52')
    })
})

describe('addressPrecision', () => {
    it('reads how far down the address the lookup got', () => {
        expect(addressPrecision('広島県広島市中区基町１０番')).toBe(ADDRESS_PRECISION.Block)
        expect(addressPrecision('広島県呉市中央四丁目')).toBe(ADDRESS_PRECISION.Chome)
        expect(addressPrecision('広島県広島市中区基町')).toBe(ADDRESS_PRECISION.Town)
    })

    it('counts a lot number (番地) as the block, where there is no 住居表示', () => {
        expect(addressPrecision('広島県三次市テスト町２２７６番地')).toBe(ADDRESS_PRECISION.Block)
    })
})

describe('parseGsiResponse', () => {
    it('takes the first feature as latitude and longitude', () => {
        const body = [{
            geometry: { coordinates: [132.4596, 34.3963], type: 'Point' },
            properties: { title: '広島県広島市中区基町１０番' }
        }]
        expect(parseGsiResponse(body)).toEqual({ lat: 34.3963, lng: 132.4596, precision: ADDRESS_PRECISION.Block })
    })

    it('returns null for an empty or malformed answer', () => {
        expect(parseGsiResponse([])).toBeNull()
        expect(parseGsiResponse([{ geometry: { coordinates: ['x', 1] }, properties: { title: 'a' } }])).toBeNull()
        expect(parseGsiResponse({ error: 'nope' })).toBeNull()
    })

    it('refuses coordinates outside the valid range, which the pin constraint would reject', () => {
        const at = (lng: number, lat: number) => [{ geometry: { coordinates: [lng, lat] }, properties: { title: '番' } }]
        expect(parseGsiResponse(at(132.4596, 134.3963))).toBeNull()
        expect(parseGsiResponse(at(232.4596, 34.3963))).toBeNull()
    })
})

describe('planFill', () => {
    const [both, nameOnly, addressOnly, noPin, unmatched] = matchFacilityPins([
        facility('f1', 'テスト中央病院', '広島市', '中区基町10-52'),
        facility('f2', 'テスト中央病院', '広島市', '中区大手町1-1'),
        facility('f3', 'みどりクリニック', '呉市', '中央4-1-6'),
        facility('f5', 'テスト歯科医院', '三原市', '城町1-2-1'),
        facility('f4', '存在しない医院', '尾道市', '土堂1-1')
    ], INSTITUTIONS)
    // About 60 m from RENAMED, and about 2 km from it.
    const NEAR_RENAMED: AddressPin = { lat: 34.2497, lng: 132.5662, precision: ADDRESS_PRECISION.Block }
    const FAR_FROM_RENAMED: AddressPin = { lat: 34.2672, lng: 132.5658, precision: ADDRESS_PRECISION.Block }
    const ONOMICHI_BLOCK: AddressPin = { lat: 34.4089, lng: 133.2050, precision: ADDRESS_PRECISION.Block }

    it('uses the ministry pin when the name and the address agree, without a lookup', () => {
        expect(both && planFill(both, new Set())).toMatchObject({ source: PIN_SOURCE.Ministry, lat: HOSPITAL.lat })
    })

    it('fills a one-sided ministry pin when the street address lands within 150 m of it', () => {
        expect(addressOnly && planFill(addressOnly, new Set(), NEAR_RENAMED))
            .toMatchObject({ source: PIN_SOURCE.MinistryConfirmedByAddress, lat: RENAMED.lat, lng: RENAMED.lng })
    })

    it('leaves a one-sided ministry pin the address puts far away for a person', () => {
        expect(addressOnly && planFill(addressOnly, new Set(), FAR_FROM_RENAMED)).toBeNull()
        expect(nameOnly && planFill(nameOnly, new Set(), null)).toBeNull()
    })

    it('uses a block-level address when the ministry has no row or a 0,0 pin', () => {
        expect(unmatched && planFill(unmatched, new Set(), ONOMICHI_BLOCK))
            .toMatchObject({ source: PIN_SOURCE.Address, lat: ONOMICHI_BLOCK.lat, lng: ONOMICHI_BLOCK.lng })
        expect(noPin && planFill(noPin, new Set(), ONOMICHI_BLOCK)).toMatchObject({ source: PIN_SOURCE.Address })
    })

    it('never uses an address found only to the town or 丁目, or at 0,0', () => {
        const town = { ...ONOMICHI_BLOCK, precision: ADDRESS_PRECISION.Town }
        const chome = { ...ONOMICHI_BLOCK, precision: ADDRESS_PRECISION.Chome }
        const zero = { lat: 0, lng: 0, precision: ADDRESS_PRECISION.Block }
        expect(unmatched && planFill(unmatched, new Set(), town)).toBeNull()
        expect(unmatched && planFill(unmatched, new Set(), chome)).toBeNull()
        expect(unmatched && planFill(unmatched, new Set(), zero)).toBeNull()
    })
})

describe('planClosestFill', () => {
    const [nameOnly, noPin, unmatched] = matchFacilityPins([
        facility('f2', 'テスト中央病院', '広島市', '中区大手町1-1'),
        facility('f5', 'テスト歯科医院', '三原市', '城町1-2-1'),
        facility('f4', '存在しない医院', '尾道市', '土堂1-1')
    ], INSTITUTIONS)
    const BLOCK: AddressPin = { lat: 34.3925, lng: 132.4555, precision: ADDRESS_PRECISION.Block }
    const TOWN: AddressPin = { lat: 34.41, lng: 133.2, precision: ADDRESS_PRECISION.Town }
    const CITY: AddressPin = { lat: 34.4089, lng: 133.205, precision: ADDRESS_PRECISION.Town }

    it('prefers the block-level street address over a ministry pin that disagrees', () => {
        expect(nameOnly && planClosestFill(nameOnly, BLOCK))
            .toMatchObject({ source: PIN_SOURCE.AddressOverMinistry, lat: BLOCK.lat })
    })

    it('uses the ministry pin when the address did not reach the block', () => {
        expect(nameOnly && planClosestFill(nameOnly, TOWN))
            .toMatchObject({ source: PIN_SOURCE.MinistryUnconfirmed, lat: HOSPITAL.lat })
    })

    it('uses the town the address reached, then the city center, when the ministry has no pin', () => {
        expect(noPin && planClosestFill(noPin, TOWN)).toMatchObject({ source: PIN_SOURCE.AddressApproximate })
        expect(unmatched && planClosestFill(unmatched, null, CITY))
            .toMatchObject({ source: PIN_SOURCE.CityCenter, lat: CITY.lat })
    })

    it('leaves a facility alone when nothing at all was found', () => {
        expect(unmatched && planClosestFill(unmatched, null, null)).toBeNull()
    })
})

describe('createGsiGeocoder', () => {
    it('sends the encoded street and reads the answer', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([{
            geometry: { coordinates: [132.4596, 34.3963] }, properties: { title: '広島県広島市中区基町１０番' }
        }])))
        const pin = await createGsiGeocoder(fetchImpl, 0)('広島県広島市中区基町10-52')

        expect(pin).toEqual({ lat: 34.3963, lng: 132.4596, precision: ADDRESS_PRECISION.Block })
        expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(encodeURIComponent('広島県広島市中区基町10-52'))
    })

    it('fails on an HTTP error instead of reading it as no match', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => new Response('busy', { status: 503 }))
        await expect(createGsiGeocoder(fetchImpl, 0)('広島県')).rejects.toThrow(/503/)
    })

    it('still pauses after a failed lookup', async () => {
        vi.useFakeTimers()
        try {
            const fetchImpl = vi.fn<typeof fetch>(async () => new Response('busy', { status: 503 }))
            let settled = false
            const lookup = createGsiGeocoder(fetchImpl, 250)('広島県').catch(() => {
                settled = true
            })
            await vi.advanceTimersByTimeAsync(249)
            expect(settled).toBe(false)
            await vi.advanceTimersByTimeAsync(1)
            await lookup
            expect(settled).toBe(true)
        } finally {
            vi.useRealTimers()
        }
    })
})

describe('parseMinistryCsv', () => {
    it('reads the ministry columns', () => {
        const csv = '﻿ID,正式名称,所在地,所在地座標（緯度）,所在地座標（経度）\n'
            + 'M1,テスト中央病院,広島県広島市中区基町１０番５２号,34.3963,132.4596\n'
        expect(parseMinistryCsv(csv)).toEqual([HOSPITAL])
    })
})

describe('the CSV readers', () => {
    it('refuse a ministry file without the coordinate columns before planning anything', () => {
        expect(() => parseMinistryCsv('ID,正式名称,所在地\nM1,テスト中央病院,広島県広島市\n'))
            .toThrow(/所在地座標（緯度）/)
    })

    it('refuse a verification file without the pin check column', () => {
        expect(() => parseApprovedIds('id,name_en\nf1,Test\n')).toThrow(/check_map_pin_place/)
    })
})

describe('parseApprovedIds', () => {
    it('takes the facilities whose pin check says ok', () => {
        const csv = 'id,check_map_pin_place\nf1,ok\nf2,\nf3,Yes\nf4,wrong\n'
        expect([...parseApprovedIds(csv)].sort()).toEqual(['f1', 'f3'])
    })
})

type Query = { text: string, values: unknown[] }

/** A pg client that returns the pinless rows and records every statement. */
function fakeClient(rows: Record<string, string>[]) {
    const queries: Query[] = []
    const client = {
        query: vi.fn(async (text: string, values: unknown[] = []) => {
            queries.push({ text, values })
            if (text.includes('select id, name_ja')) {
                return { rows, rowCount: rows.length }
            }
            return { rows: [], rowCount: text.includes('update facilities') ? 1 : 0 }
        })
    }
    return { client: client as unknown as pg.ClientBase, queries }
}

const PINLESS_ROWS = [
    { id: 'f1', name_ja: 'テスト中央病院', prefecture_ja: '広島県', city_ja: '広島市', address_line1_ja: '中区基町10-52' },
    { id: 'f2', name_ja: 'テスト中央病院', prefecture_ja: '広島県', city_ja: '広島市', address_line1_ja: '中区大手町1-1' }
]

describe('backfillFacilityPins', () => {
    it('reports what it would fill and writes nothing in a dry-run', async () => {
        const { client, queries } = fakeClient(PINLESS_ROWS)
        const report = await backfillFacilityPins(client, INSTITUTIONS, new Set(), false)

        expect(report).toMatchObject({ pinless: 2, toFill: 1, sampleIds: ['f1'], updated: 0 })
        expect(report.byLevel).toMatchObject({ name_and_address: 1, name_only: 1 })
        expect(queries.some(query => query.text.includes('update facilities'))).toBe(false)
    })

    it('reads only facilities from the ministry import, whose pages carry the credit', async () => {
        const { client, queries } = fakeClient(PINLESS_ROWS)
        await backfillFacilityPins(client, INSTITUTIONS, new Set(), false)

        expect(queries[0]?.text).toContain('source = \'MHLW_MULTILINGUAL_INSTITUTIONS\'')
    })

    it('writes the ministry pin only where the row still has none', async () => {
        const { client, queries } = fakeClient(PINLESS_ROWS)
        const report = await backfillFacilityPins(client, INSTITUTIONS, new Set(), true)
        const updates = queries.filter(query => query.text.includes('update facilities'))

        expect(report.updated).toBe(1)
        expect(updates).toHaveLength(1)
        expect(updates[0]?.values).toEqual([HOSPITAL.lat, HOSPITAL.lng, 'f1'])
        expect(updates[0]?.text).toContain('map_latitude is null')
        expect(queries.map(query => query.text)).toContain('commit')
    })

    it('looks up only what the ministry does not settle, and writes the address pin', async () => {
        const rows = [
            ...PINLESS_ROWS,
            { id: 'f4', name_ja: '存在しない医院', prefecture_ja: '広島県', city_ja: '尾道市', address_line1_ja: '土堂1-1' }
        ]
        const { client, queries } = fakeClient(rows)
        const geocode = vi.fn(async (street: string) => (street.includes('尾道市')
            ? { lat: 34.4089, lng: 133.2050, precision: ADDRESS_PRECISION.Block }
            : null))
        const report = await backfillFacilityPins(client, INSTITUTIONS, new Set(), true, geocode)
        const updates = queries.filter(query => query.text.includes('update facilities'))

        expect(geocode).toHaveBeenCalledTimes(2)
        expect(report).toMatchObject({ addressLookups: 2, toFill: 2, updated: 2 })
        expect(report.bySource).toMatchObject({ ministry: 1, ministry_confirmed_by_address: 0, address: 1 })
        expect(report.approximateIds).toEqual([])
        expect(updates.map(update => update.values)).toContainEqual([34.4089, 133.2050, 'f4'])
    })

    it('with closest, fills what planFill leaves and lists those ids as approximate', async () => {
        const rows = [
            ...PINLESS_ROWS,
            { id: 'f4', name_ja: '存在しない医院', prefecture_ja: '広島県', city_ja: '尾道市', address_line1_ja: '土堂1-1' }
        ]
        const { client } = fakeClient(rows)
        const geocode = vi.fn(async (query: string) => (query === '広島県尾道市'
            ? { lat: 34.4089, lng: 133.2050, precision: ADDRESS_PRECISION.Town }
            : null))
        const report = await backfillFacilityPins(client, INSTITUTIONS, new Set(), false, geocode, true)

        expect(geocode).toHaveBeenCalledWith('広島県尾道市')
        expect(report.bySource).toMatchObject({ ministry: 1, ministry_unconfirmed: 1, city_center: 1 })
        expect(report.approximateIds.sort()).toEqual(['f2', 'f4'])
    })

    it('without closest, lists nothing as approximate', async () => {
        const { client } = fakeClient(PINLESS_ROWS)
        const report = await backfillFacilityPins(client, INSTITUTIONS, new Set(), false, vi.fn(async () => null))

        expect(report).toMatchObject({ toFill: 1, approximateIds: [] })
    })

    it('counts a failed lookup and leaves that facility alone', async () => {
        const { client } = fakeClient(PINLESS_ROWS)
        const geocode = vi.fn(async () => {
            throw new Error('GSI address search returned HTTP 503')
        })
        const report = await backfillFacilityPins(client, INSTITUTIONS, new Set(), false, geocode)

        expect(report).toMatchObject({ addressLookups: 1, addressLookupFailures: 1, toFill: 1 })
    })
})

describe('main', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('refuses a production write without --confirm-production', async () => {
        vi.stubEnv('FINDADOC_DB_TARGET', 'production')
        vi.stubEnv('PGHOST', 'findadoc.example.ap-northeast-1.rds.amazonaws.com')
        vi.stubEnv('PGHOSTADDR', '127.0.0.1')
        vi.stubEnv('PGPORT', '15432')
        vi.stubEnv('PGUSER', 'findadoc_operator')
        vi.stubEnv('PGPASSWORD', 'fake-iam-token')
        vi.stubEnv('PGSSLROOTCERT', CA_BUNDLE)

        await expect(main(['node', 'backfillFacilityPins.ts', '--write', '--csv', 'missing.csv']))
            .rejects.toThrow(/confirm-production/)
    })
})
