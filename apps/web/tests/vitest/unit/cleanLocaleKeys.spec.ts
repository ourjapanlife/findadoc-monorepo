/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { templateKeys } from '../../../i18n/cleanUnusedLocaleKeys.js'

describe('templateKeys', () => {
    it('keeps a key that only <i18n-t keypath> reads, so the cleaner does not prune it', () => {
        const template = `
            <p>{{ t('search.heading') }}</p>
            <i18n-t keypath="searchResultsDetails.sourceCredit" tag="p">
                <template #list><a>{{ t('searchResultsDetails.sourceInstitutionList') }}</a></template>
            </i18n-t>`

        expect(templateKeys(template)).to.have.members([
            'search.heading',
            'searchResultsDetails.sourceInstitutionList',
            'searchResultsDetails.sourceCredit'
        ])
    })

    it('skips a bound keypath, whose key is only known at runtime', () => {
        expect(templateKeys('<i18n-t :keypath="creditKey" tag="p" />')).to.deep.equal([])
    })
})
