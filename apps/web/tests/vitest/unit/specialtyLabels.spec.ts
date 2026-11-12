import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'chai'
import { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import { SPECIALTY_CATEGORY_LABELS, SPECIALTY_LABELS } from '@findadoc/utils'
import { CATEGORY_LABEL_KEYS, SPECIALTY_LABEL_KEYS } from '~/stores/specialtiesStore'

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '../../../i18n/locales')

function messages(locale: string): Record<string, unknown> {
    return JSON.parse(readFileSync(join(localesDir, `${locale}.json`), 'utf8')) as Record<string, unknown>
}

function message(source: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        source
    )
}

// The API serves the labels in @findadoc/utils (#24). They must say what the site says.
describe('specialty labels the API serves', () => {
    const en = messages('en')
    const ja = messages('ja')

    it('match the site\'s English and Japanese specialty labels', () => {
        for (const code of Object.values(Specialty)) {
            expect(SPECIALTY_LABELS[code].nameEn, code).to.equal(message(en, SPECIALTY_LABEL_KEYS[code]))
            expect(SPECIALTY_LABELS[code].nameJa, code).to.equal(message(ja, SPECIALTY_LABEL_KEYS[code]))
        }
    })

    it('match the site\'s English and Japanese category labels', () => {
        for (const code of Object.values(SpecialtyCategory)) {
            expect(SPECIALTY_CATEGORY_LABELS[code].nameEn, code).to.equal(message(en, CATEGORY_LABEL_KEYS[code]))
            expect(SPECIALTY_CATEGORY_LABELS[code].nameJa, code).to.equal(message(ja, CATEGORY_LABEL_KEYS[code]))
        }
    })
})
