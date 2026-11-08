import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONSENT_TEXT_VERSIONS, CURRENT_CONSENT_TEXT_VERSION } from '../src/booking/consentText.js'

const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONSENT_DIR = join(SERVER_ROOT, 'docs', 'consent-text')
const LOCALES_DIR = join(SERVER_ROOT, '..', 'web', 'i18n', 'locales')

/** The text block under "## {language}" in a frozen consent file. */
function frozenText(version: string, language: 'en' | 'ja'): string | undefined {
    const markdown = readFileSync(join(CONSENT_DIR, `${version}.md`), 'utf8')
    const match = new RegExp(`^## ${language}\\n\\n\`\`\`text\\n(.+)\\n\`\`\`$`, 'm').exec(markdown)
    return match?.[1]
}

function localeConsent(file: 'en.json' | 'ja.json'): unknown {
    const parsed: unknown = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || !('bookingPage' in parsed)) {
        return undefined
    }
    const page: unknown = parsed.bookingPage
    if (typeof page !== 'object' || page === null || !('healthDataConsent' in page)) {
        return undefined
    }
    return page.healthDataConsent
}

describe('health data consent text', () => {
    it('keeps the English locale string identical to the current frozen copy', () => {
        const frozen = frozenText(CURRENT_CONSENT_TEXT_VERSION, 'en')
        expect(frozen).toBeDefined()
        expect(localeConsent('en.json')).toBe(frozen)
    })

    it('keeps the Japanese locale string identical to the current frozen copy', () => {
        const frozen = frozenText(CURRENT_CONSENT_TEXT_VERSION, 'ja')
        expect(frozen).toBeDefined()
        expect(localeConsent('ja.json')).toBe(frozen)
    })

    it('has a frozen English and Japanese copy for every version, and no unlisted copies', () => {
        const files = readdirSync(CONSENT_DIR).filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort()
        expect(files).toEqual(CONSENT_TEXT_VERSIONS.map(version => `${version}.md`))
        for (const version of CONSENT_TEXT_VERSIONS) {
            expect(frozenText(version, 'en')).toContain('{clinic}')
            expect(frozenText(version, 'ja')).toContain('{clinic}')
        }
    })

    it('makes the current version the newest one', () => {
        expect(CONSENT_TEXT_VERSIONS.at(-1)).toBe(CURRENT_CONSENT_TEXT_VERSION)
    })
})
