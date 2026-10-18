import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'chai'
import i18nLocales from '@/i18n'
import { allowedSameAsEnglishKeys, localeFileProblems } from '../../../i18n/checkLocaleKeys.js'
import { localeMessageProblems } from '../../../i18n/localeMessages.js'

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), '../../../i18n')
const localesDir = join(i18nDir, 'locales')

describe('site UI locales', () => {
    it('lists English, then Japanese, then locales by foreign-resident population', () => {
        const codes = i18nLocales.map(locale => locale.code)

        expect(codes[0]).to.equal('en-US')
        expect(codes).to.deep.equal([
            'en-US',
            'ja-JP',
            'zh-CN',
            'vi-VN',
            'ko-KR',
            'tl-PH',
            'pt-BR',
            'fr-FR',
            'ru-RU',
            'de-DE',
            'it-IT'
        ])
        expect(i18nLocales.find(locale => locale.code === 'ko-KR')?.file).to.equal('ko.json')
        for (const locale of i18nLocales) {
            expect(locale.language, locale.code).to.equal(locale.code)
        }
    })

    it('fails when a locale is missing a key, drops a placeholder, or copies the English sentence', () => {
        expect(localeMessageProblems(
            { greet: 'Hello {name}' },
            { greet: 'Hello' },
            new Set()
        )).to.deep.equal(['greet: placeholders must match English ({name})'])

        expect(localeMessageProblems(
            { greet: 'Hello' },
            {},
            new Set()
        )).to.deep.equal(['greet: missing'])

        expect(localeMessageProblems(
            { greet: 'Hello' },
            { greet: 'Hello' },
            new Set()
        )).to.deep.equal(['greet: still the English sentence'])

        expect(localeMessageProblems(
            { brand: 'Find a Doc', empty: '—' },
            { brand: 'Find a Doc', empty: '—' },
            new Set(['brand'])
        )).to.deep.equal([])
    })

    it('keeps every locale file aligned with English', () => {
        const allowlist = JSON.parse(readFileSync(join(i18nDir, 'sameAsEnglish.json'), 'utf8')) as {
            all?: string[]
        }
        const problems = localeFileProblems(localesDir, allowlist)

        expect(problems, problems.slice(0, 12).join('\n')).to.deep.equal([])
        expect(allowedSameAsEnglishKeys(allowlist, 'ja.json').has('common.siteName')).to.equal(true)
    })

    it('ships a JSON file for every registered site locale', () => {
        const files = new Set(readdirSync(localesDir).filter(name => name.endsWith('.json')))

        for (const locale of i18nLocales) {
            const configuredFile = locale.file
            if (configuredFile === undefined) {
                throw new Error(`Locale ${locale.code} has no file`)
            }

            const filename = typeof configuredFile === 'string' ? configuredFile : configuredFile.path
            expect(files.has(filename), filename).to.equal(true)
        }
    })
})
