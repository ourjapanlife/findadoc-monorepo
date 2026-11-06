import { describe, expect, it } from 'vitest'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'
import { directoryDrift, expectedDirectoryPaths, sitemapDirectoryPaths } from '~/utils/directoryDrift'

const clinic = {
    id: 'facility-1',
    nameEn: 'Example Dental',
    online: false,
    contact: { address: { cityEn: 'Minato', prefectureEn: 'Tokyo' } }
} as unknown as Facility

const doctor = {
    id: 'professional-1',
    names: [{ firstName: 'Taro', lastName: 'Example', locale: 'en_US' }]
} as unknown as HealthcareProfessional

const sitemap = (locs: string[]) => `<?xml version="1.0"?><urlset>${
    locs.map(loc => `<url><loc>${loc}</loc></url>`).join('')
}</urlset>`

describe('directory drift', () => {
    it('reads only the English clinic and doctor pages from a sitemap', () => {
        const paths = sitemapDirectoryPaths(sitemap([
            'https://www.findadoc.jp/clinic/tokyo/minato/example-dental--facility-1',
            'https://www.findadoc.jp/ja/clinic/tokyo/minato/example-dental--facility-1',
            'https://www.findadoc.jp/doctor/taro-example--professional-1/',
            'https://www.findadoc.jp/tokyo',
            'https://www.findadoc.jp/about',
            'not a url'
        ]))

        expect([...paths].sort()).toEqual([
            '/clinic/tokyo/minato/example-dental--facility-1',
            '/doctor/taro-example--professional-1'
        ])
    })

    it('matches a percent-encoded Japanese doctor path to the same path from the API', () => {
        const japaneseDoctor = {
            id: 'professional-2',
            names: [{ firstName: '輝', lastName: '山口', locale: 'ja_JP' }]
        } as unknown as HealthcareProfessional
        const [expected] = [...expectedDirectoryPaths([], [japaneseDoctor])]
        const published = sitemapDirectoryPaths(sitemap([`https://www.findadoc.jp${encodeURI(expected ?? '')}`]))

        expect(directoryDrift(new Set([expected ?? '']), published)).toEqual({ missing: [], removed: [] })
    })

    it('reports nothing when the live site lists every page', () => {
        const expected = expectedDirectoryPaths([clinic], [doctor])
        const published = sitemapDirectoryPaths(sitemap([...expected].map(path => `https://www.findadoc.jp${path}`)))

        expect(directoryDrift(expected, published)).toEqual({ missing: [], removed: [] })
    })

    it('reports a clinic created after the last build as missing', () => {
        const expected = expectedDirectoryPaths([clinic], [doctor])
        const published = sitemapDirectoryPaths(sitemap(['https://www.findadoc.jp/doctor/taro-example--professional-1']))

        expect(directoryDrift(expected, published)).toEqual({
            missing: ['/clinic/tokyo/minato/example-dental--facility-1'],
            removed: []
        })
    })

    it('reports a renamed clinic as one missing and one removed page', () => {
        const renamed = { ...clinic, nameEn: 'Example Dental Minato' } as Facility
        const expected = expectedDirectoryPaths([renamed], [])
        const published = sitemapDirectoryPaths(sitemap([
            'https://www.findadoc.jp/clinic/tokyo/minato/example-dental--facility-1'
        ]))

        expect(directoryDrift(expected, published)).toEqual({
            missing: ['/clinic/tokyo/minato/example-dental-minato--facility-1'],
            removed: ['/clinic/tokyo/minato/example-dental--facility-1']
        })
    })

    it('treats a missing sitemap as every page missing', () => {
        const expected = expectedDirectoryPaths([clinic], [doctor])

        expect(directoryDrift(expected, sitemapDirectoryPaths('')).missing).toHaveLength(2)
    })
})
