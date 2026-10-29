/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PRIVACY_SECTIONS } from '@/utils/privacyPolicy'

const localesDir = join(__dirname, '../../../i18n/locales')

describe('privacy policy sections', () => {
    for (const file of readdirSync(localesDir).filter(name => name.endsWith('.json'))) {
        it(`${file} has exactly the headings and paragraphs the page renders, in order`, () => {
            const sections = JSON.parse(readFileSync(join(localesDir, file), 'utf8')).privacyPage.sections as
                Record<string, Record<string, string>>
            expect(Object.keys(sections)).to.deep.equal(PRIVACY_SECTIONS.map(section => section.id))
            for (const section of PRIVACY_SECTIONS) {
                const expected = ['heading', ...Array.from({ length: section.paragraphs }, (_, i) => `p${i + 1}`)]
                expect(Object.keys(sections[section.id]!), `${file} ${section.id}`).to.deep.equal(expected)
                for (const key of expected) {
                    expect(sections[section.id]![key], `${file} ${section.id}.${key}`).to.be.a('string').and.not.equal('')
                }
            }
        })
    }

    it('keeps the anchor the consent banner links to', () => {
        expect(PRIVACY_SECTIONS.find(section => section.id === 'cookies')).to.have.property('anchor', 'cookies')
    })
})
