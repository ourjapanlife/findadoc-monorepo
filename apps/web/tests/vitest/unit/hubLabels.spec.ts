/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'chai'
import { Locale, Specialty } from '@findadoc/graphql'
import { hubFacetLabel, hubPlaceName, specialtyMessageKey } from '@/utils/hubLabels'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const en = JSON.parse(readFileSync(join(rootDir, 'i18n/locales/en.json'), 'utf8')) as {
    specialties: Record<string, string>
}

const fakeMessages: Record<string, string> = {
    'specialties.dentistry': '牙医',
    'specialties.obstetricsAndGynecology': '妇产科医生'
}
const t = (key: string) => fakeMessages[key] ?? key

describe('hubPlaceName', () => {
    it('uses the kanji name for Japanese and Chinese readers', () => {
        expect(hubPlaceName('Tokyo', '東京都', 'ja-JP')).to.equal('東京都')
        expect(hubPlaceName('Minato', '港区', 'zh-CN')).to.equal('港区')
    })

    it('uses the romaji name for every other locale, and when there is no kanji name', () => {
        expect(hubPlaceName('Tokyo', '東京都', 'ko-KR')).to.equal('Tokyo')
        expect(hubPlaceName('Tokyo', '東京都', 'en-US')).to.equal('Tokyo')
        expect(hubPlaceName('Tokyo', '', 'zh-CN')).to.equal('Tokyo')
    })
})

describe('specialtyMessageKey', () => {
    it('names a specialties message for every specialty', () => {
        for (const specialty of Object.values(Specialty)) {
            expect(en.specialties, specialty).to.have.property(specialtyMessageKey(specialty))
        }
        expect(specialtyMessageKey(Specialty.ObstetricsAndGynecology)).to.equal('obstetricsAndGynecology')
    })
})

describe('hubFacetLabel', () => {
    const dentistry = { kind: 'specialty' as const, label: 'Dentistry', specialty: Specialty.Dentistry }

    it('keeps the indexed English label on the English site', () => {
        expect(hubFacetLabel(dentistry, 'en-US', t)).to.equal('Dentistry')
    })

    it('names a specialty from the locale messages elsewhere', () => {
        expect(hubFacetLabel(dentistry, 'zh-CN', t)).to.equal('牙医')
    })

    it('names a language in the reader\'s language', () => {
        const english = { kind: 'language' as const, label: 'English', locale: Locale.EnUs }

        expect(hubFacetLabel(english, 'en-US', t)).to.equal('English')
        expect(hubFacetLabel(english, 'ja-JP', t)).to.equal('英語')
    })
})
