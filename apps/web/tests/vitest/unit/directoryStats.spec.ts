/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { Locale } from '@findadoc/graphql'
import { directoryStatsFrom, type StatsFacility } from '@/utils/directoryStats'
import {
    ALL_PREFECTURES,
    DIRECTORY_STATS,
    TOP_PREFECTURES,
    directoryCounts,
    directoryPrefectures,
    homeAreaPrefectures
} from '@/utils/homeDirectory'

function facility(prefectureEn: string | null, supportedLanguages: Locale[] = []): StatsFacility {
    return { contact: { address: { prefectureEn } }, supportedLanguages }
}

describe('directoryStatsFrom', () => {
    it('counts every facility and professional in the directory', () => {
        const stats = directoryStatsFrom(
            [facility('Tokyo'), facility('Osaka'), facility(null)],
            [{ spokenLanguages: [] }, { spokenLanguages: [] }]
        )

        expect(stats.facilities).to.equal(3)
        expect(stats.professionals).to.equal(2)
    })

    it('counts a language once across facilities and professionals', () => {
        const stats = directoryStatsFrom(
            [facility('Tokyo', [Locale.JaJp, Locale.EnUs]), facility('Osaka', [Locale.ZhCn])],
            [{ spokenLanguages: [Locale.EnUs, Locale.KoKr] }]
        )

        expect(stats.languages).to.equal(4)
    })

    it('orders prefectures by facility count, then by name, with the Japanese name', () => {
        const stats = directoryStatsFrom(
            [facility('Osaka'), facility('Tokyo'), facility('Tokyo'), facility('Aichi')],
            []
        )

        expect(stats.prefectures).to.deep.equal([
            { name: 'Tokyo', nameJa: '東京都', approximateFacilities: 2 },
            { name: 'Aichi', nameJa: '愛知県', approximateFacilities: 1 },
            { name: 'Osaka', nameJa: '大阪府', approximateFacilities: 1 }
        ])
    })

    it('leaves out an online facility and a name that is not a prefecture', () => {
        const stats = directoryStatsFrom([facility(null), facility('Tokyo-to'), facility('Kyoto')], [])

        expect(stats.prefectures.map(entry => entry.name)).to.deep.equal(['Kyoto'])
    })
})

describe('directoryCounts', () => {
    it('uses the counts from this build', () => {
        const generated = directoryStatsFrom([facility('Tokyo', [Locale.EnUs])], [{ spokenLanguages: [] }])

        expect(directoryCounts(generated)).to.deep.equal({ facilities: 1, professionals: 1, languages: 1 })
    })

    it('falls back outside generate and when the build has no directory', () => {
        expect(directoryCounts(null)).to.equal(DIRECTORY_STATS)
        expect(directoryCounts(directoryStatsFrom([], []))).to.equal(DIRECTORY_STATS)
    })
})

describe('directoryPrefectures', () => {
    it('uses the prefectures from this build', () => {
        const generated = directoryStatsFrom([facility('Kagawa')], [])

        expect(directoryPrefectures(generated).map(entry => entry.name)).to.deep.equal(['Kagawa'])
    })

    it('falls back to the static list when the build has none', () => {
        expect(directoryPrefectures(undefined)).to.equal(ALL_PREFECTURES)
        expect(directoryPrefectures(directoryStatsFrom([], []))).to.equal(ALL_PREFECTURES)
    })
})

describe('homeAreaPrefectures with the generated list', () => {
    it('takes the top eight from the list it is given', () => {
        const names = ['Tokyo', 'Osaka', 'Ibaraki', 'Kagawa', 'Kanagawa', 'Fukuoka', 'Saitama', 'Nara', 'Aichi']
        const generated = directoryStatsFrom(
            names.flatMap((name, index) => Array.from({ length: names.length - index }, () => facility(name))),
            []
        ).prefectures

        expect(homeAreaPrefectures(null, generated).map(entry => entry.name)).to.deep.equal(names.slice(0, 8))
    })

    it('keeps the static top eight when it is given the static list', () => {
        expect(homeAreaPrefectures(null, ALL_PREFECTURES)).to.equal(TOP_PREFECTURES)
    })
})
