import { describe, expect, it } from 'vitest'
import {
    JAPAN_REGIONS,
    REGION_PREFECTURES,
    parseRegion,
    prefecturesInRegion,
    regionOfPrefecture,
    regionSearchParam,
    regionsWithPrefectures
} from '~/utils/japanRegions'
import { listPrefectureJapanEn } from '~/utils/prefectureNames'

describe('japanRegions', () => {
    it('files every one of the 47 prefectures under exactly one region', () => {
        const filed = JAPAN_REGIONS.flatMap(region => REGION_PREFECTURES[region])

        expect([...filed].sort()).toEqual([...listPrefectureJapanEn].sort())
        expect(new Set(filed).size).toBe(47)
    })

    it('finds the region from an English name, a URL slug, or a Japanese name', () => {
        expect(regionOfPrefecture('Tokyo')).toBe('KANTO')
        expect(regionOfPrefecture('osaka')).toBe('KANSAI')
        expect(regionOfPrefecture('沖縄県')).toBe('KYUSHU')
        expect(regionOfPrefecture('Atlantis')).toBeUndefined()
        expect(regionOfPrefecture(undefined)).toBeUndefined()
    })

    it('reads a region from the URL and refuses anything else', () => {
        expect(parseRegion('kanto')).toBe('KANTO')
        expect(parseRegion('KYUSHU')).toBe('KYUSHU')
        expect(parseRegion('tokyo')).toBeUndefined()
        expect(regionSearchParam('HOKKAIDO')).toBe('hokkaido')
    })

    it('narrows a prefecture list to one region and keeps all of it with no region', () => {
        const entries = [{ name: 'Tokyo' }, { name: 'Osaka' }, { name: 'Kanagawa' }]

        expect(prefecturesInRegion(entries, 'KANTO').map(entry => entry.name)).toEqual(['Tokyo', 'Kanagawa'])
        expect(prefecturesInRegion(entries, undefined)).toHaveLength(3)
    })

    it('offers only regions the directory covers, plus one already picked', () => {
        const entries = [{ name: 'Osaka' }, { name: 'Tokyo' }]

        expect(regionsWithPrefectures(entries, undefined)).toEqual(['KANTO', 'KANSAI'])
        expect(regionsWithPrefectures(entries, 'SHIKOKU')).toEqual(['KANTO', 'KANSAI', 'SHIKOKU'])
    })
})
