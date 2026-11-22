import { fileURLToPath } from 'node:url'
import type pg from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    addressKey,
    backfillFacilityPins,
    main,
    MATCH_LEVEL,
    matchFacilityPins,
    parseApprovedIds,
    parseMinistryCsv,
    shouldFill,
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
