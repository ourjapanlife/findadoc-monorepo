import { expect } from 'chai'
import { languageName } from '~/utils/languageName'

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
