import { expect } from 'chai'
import { languageName, spokenLanguageNames } from '~/utils/languageName'

describe('languageName', () => {
    it('names a language in the reader\'s language', () => {
        expect(languageName('zh_CN', 'en-US')).to.equal('Chinese')
        expect(languageName('zh_CN', 'ja-JP')).to.equal('中国語')
    })

    it('uses each language\'s own name when the browser has no names for the reader\'s language', () => {
        expect(languageName('vi_VN', 'xx-YY')).to.equal('Tiếng Việt')
        expect(languageName('ja_JP', 'xx-YY')).to.equal('日本語')
        expect(languageName('ne_NP', 'xx-YY')).to.equal('नेपाली')
    })
})

describe('spokenLanguageNames', () => {
    it('names directory languages in the reader\'s language, in order', () => {
        expect(spokenLanguageNames(['ja_JP', 'en_US', 'fr_FR'], 'ja-JP')).to.deep.equal(['日本語', '英語', 'フランス語'])
        expect(spokenLanguageNames(['ja_JP', 'ko_KR'], 'en-US')).to.deep.equal(['Japanese', 'Korean'])
    })

    it('drops codes the directory does not list, and shows a shared name once', () => {
        expect(spokenLanguageNames(['und', 'en_US', 'xx_YY'], 'en-US')).to.deep.equal(['English'])
        expect(spokenLanguageNames(['zh_CN', 'zh_TW'], 'en-US')).to.deep.equal(['Chinese'])
    })
})
