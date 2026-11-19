/// <reference types="vitest/globals" />
import { expect } from 'chai'
import {
    directoryLocaleCodesForPath,
    isPrerenderedDirectoryPath,
    withDirectoryLocaleVariants
} from '@/utils/directoryLocales'
import { DIRECTORY_PRERENDER_LOCALE_CODES, HUB_PRERENDER_LOCALE_CODES, LOCALE_CODES } from '@/utils/localePath'

describe('directoryLocaleCodesForPath', () => {
    it('gives hub and facet pages the wider locale list', () => {
        expect(directoryLocaleCodesForPath('/tokyo')).to.equal(HUB_PRERENDER_LOCALE_CODES)
        expect(directoryLocaleCodesForPath('/tokyo/minato')).to.equal(HUB_PRERENDER_LOCALE_CODES)
        expect(directoryLocaleCodesForPath('/zh-CN/tokyo/dentistry')).to.equal(HUB_PRERENDER_LOCALE_CODES)
    })

    it('keeps clinic, doctor, and booking pages in English and Japanese', () => {
        expect(directoryLocaleCodesForPath('/clinic/tokyo/shibuya/clinic--abc')).to.equal(DIRECTORY_PRERENDER_LOCALE_CODES)
        expect(directoryLocaleCodesForPath('/ko-KR/doctor/aiko-tanaka--p1')).to.equal(DIRECTORY_PRERENDER_LOCALE_CODES)
        expect(directoryLocaleCodesForPath('/book/abc')).to.equal(DIRECTORY_PRERENDER_LOCALE_CODES)
    })

    it('is a strict subset of the site locales, English and Japanese first', () => {
        expect(HUB_PRERENDER_LOCALE_CODES.slice(0, 2)).to.deep.equal(['en-US', 'ja-JP'])
        expect(HUB_PRERENDER_LOCALE_CODES.every(code => LOCALE_CODES.includes(code))).to.equal(true)
        expect(HUB_PRERENDER_LOCALE_CODES.length).to.be.lessThan(LOCALE_CODES.length)
    })
})

describe('isPrerenderedDirectoryPath', () => {
    it('is true only for a locale generate writes for that kind of page', () => {
        expect(isPrerenderedDirectoryPath('/zh-CN/tokyo')).to.equal(true)
        expect(isPrerenderedDirectoryPath('/ne-NP/tokyo')).to.equal(false)
        expect(isPrerenderedDirectoryPath('/zh-CN/clinic/tokyo/shibuya/clinic--abc')).to.equal(false)
        expect(isPrerenderedDirectoryPath('/ja-JP/clinic/tokyo/shibuya/clinic--abc')).to.equal(true)
    })
})

describe('withDirectoryLocaleVariants', () => {
    it('writes each page in its own locale list, default locale unprefixed', () => {
        const variants = withDirectoryLocaleVariants(['/clinic/tokyo/shibuya/clinic--abc', '/tokyo'])

        expect(variants).to.deep.equal([
            '/clinic/tokyo/shibuya/clinic--abc',
            '/ja-JP/clinic/tokyo/shibuya/clinic--abc',
            '/tokyo',
            '/ja-JP/tokyo',
            '/zh-CN/tokyo',
            '/vi-VN/tokyo',
            '/ko-KR/tokyo'
        ])
    })
})
