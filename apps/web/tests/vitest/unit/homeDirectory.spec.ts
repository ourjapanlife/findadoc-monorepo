/// <reference types="vitest/globals" />
import { expect } from 'chai'
import {
    ALL_PREFECTURES,
    areaPrefectureLink,
    categorySpecialtyLink,
    homeAreaPrefectures,
    prefectureOptionLabel,
    SEARCHABLE_LANGUAGES,
    TOP_PREFECTURES,
    totalFacilities,
    type PrefectureEntry
} from '@/utils/homeDirectory'
import { Specialty, Locale } from '@findadoc/graphql'
import { listPrefectureJapanEn, listPrefectureJapanJa } from '@/utils/prefectureNames'

function prefecture(name: string): PrefectureEntry {
    const entry = ALL_PREFECTURES.find(item => item.name === name)
    if (!entry) {
        throw new Error(`missing prefecture ${name}`)
    }
    return entry
}

const tokyo = prefecture('Tokyo')
const osaka = prefecture('Osaka')

describe('ALL_PREFECTURES', () => {
    // The hand-measured fallback had no Hiroshima, so the pickers dropped it.
    it('lists every prefecture once, in code order, with its standard names', () => {
        expect(ALL_PREFECTURES.map(entry => entry.name)).to.deep.equal([...listPrefectureJapanEn])
        expect(ALL_PREFECTURES.map(entry => entry.nameJa)).to.deep.equal([...listPrefectureJapanJa])
    })

    it('writes no count by hand', () => {
        expect(ALL_PREFECTURES.every(entry => entry.approximateFacilities === undefined)).to.equal(true)
    })
})

describe('prefectureOptionLabel', () => {
    it('shows the count only when the directory gave one', () => {
        expect(prefectureOptionLabel({ name: 'Hiroshima', nameJa: '広島県', approximateFacilities: 24 }, false))
            .to.equal('Hiroshima (24)')
        expect(prefectureOptionLabel({ name: 'Hiroshima', nameJa: '広島県', approximateFacilities: 24 }, true))
            .to.equal('広島県 (24)')
        expect(prefectureOptionLabel({ name: 'Hiroshima', nameJa: '広島県' }, false)).to.equal('Hiroshima')
    })
})

describe('totalFacilities', () => {
    it('sums a region only when every prefecture has a count', () => {
        expect(totalFacilities([
            { name: 'Osaka', nameJa: '大阪府', approximateFacilities: 30 },
            { name: 'Kyoto', nameJa: '京都府', approximateFacilities: 12 }
        ])).to.equal(42)
        expect(totalFacilities([
            { name: 'Osaka', nameJa: '大阪府', approximateFacilities: 30 },
            { name: 'Kyoto', nameJa: '京都府' }
        ])).to.equal(undefined)
    })
})

describe('areaPrefectureLink', () => {
    it('points at the prefecture hub when generate has not filtered the list', () => {
        expect(areaPrefectureLink(tokyo, null)).to.equal('/tokyo')
        expect(areaPrefectureLink(osaka, undefined)).to.equal('/osaka')
    })

    it('keeps hubs that exist in this generate and sends the rest to search', () => {
        const generated = ['/tokyo', '/hokkaido']

        expect(areaPrefectureLink(tokyo, generated)).to.equal('/tokyo')
        expect(areaPrefectureLink(osaka, generated)).to.deep.equal({
            path: '/search',
            query: { prefecture: 'osaka' }
        })
    })

    it('sends every chip to search when generate found no prefecture hubs', () => {
        expect(areaPrefectureLink(tokyo, [])).to.deep.equal({
            path: '/search',
            query: { prefecture: 'tokyo' }
        })
    })
})

describe('homeAreaPrefectures', () => {
    it('shows the static top eight outside generate', () => {
        expect(homeAreaPrefectures(null)).to.equal(TOP_PREFECTURES)
        expect(homeAreaPrefectures(undefined)).to.equal(TOP_PREFECTURES)
    })

    it('keeps volume order among hubs this generate actually built', () => {
        expect(homeAreaPrefectures(['/osaka', '/tokyo']).map(entry => entry.name))
            .to.deep.equal(['Tokyo', 'Osaka'])
    })

    it('falls back to generated hubs outside the top eight when the seed missed them', () => {
        expect(homeAreaPrefectures(['/hiroshima']).map(entry => entry.name))
            .to.deep.equal(['Hiroshima'])
    })

    it('keeps the static top eight when generate found no hubs', () => {
        expect(homeAreaPrefectures([])).to.equal(TOP_PREFECTURES)
    })
})

describe('categorySpecialtyLink', () => {
    it('prefers the Tokyo specialty facet outside generate', () => {
        expect(categorySpecialtyLink(Specialty.Dentistry, null)).to.equal('/tokyo/dentistry')
        expect(categorySpecialtyLink(Specialty.Dentistry, undefined)).to.equal('/tokyo/dentistry')
    })

    it('uses a Tokyo facet from this generate, or another prefecture, else search', () => {
        expect(categorySpecialtyLink(Specialty.Dentistry, ['/tokyo/dentistry', '/osaka/dentistry']))
            .to.equal('/tokyo/dentistry')
        expect(categorySpecialtyLink(Specialty.Dentistry, ['/osaka/dentistry']))
            .to.equal('/osaka/dentistry')
        expect(categorySpecialtyLink(Specialty.Dentistry, [])).to.deep.equal({
            path: '/search',
            query: { specialty: 'dentistry' }
        })
    })
})

describe('SEARCHABLE_LANGUAGES', () => {
    it('lists English, then Japanese, then languages by foreign-resident population', () => {
        expect(SEARCHABLE_LANGUAGES[0]).to.equal(Locale.EnUs)
        expect(SEARCHABLE_LANGUAGES[1]).to.equal(Locale.JaJp)
        expect(SEARCHABLE_LANGUAGES.indexOf(Locale.ZhCn)).to.be.lessThan(
            SEARCHABLE_LANGUAGES.indexOf(Locale.KoKr)
        )
        expect(SEARCHABLE_LANGUAGES.indexOf(Locale.KoKr)).to.be.lessThan(
            SEARCHABLE_LANGUAGES.indexOf(Locale.TlPh)
        )
    })
})
