/* eslint-disable camelcase -- Google consent mode field names (ad_storage, ad_user_data). */
/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { vi } from 'vitest'
import {
    consentBootstrapScript,
    consentCookie,
    consentSignals,
    denyConsent,
    grantConsent,
    parseConsentCookie,
    restoreConsent
} from '@/utils/consent'

const TAG_IDS = ['AW-18541704359', 'G-T0RE9B3PRG']

type FakeWindow = Window & { dataLayer?: IArguments[], gtag?: (...args: unknown[]) => void }

/** A window whose <head> bootstrap has run, with a spy for reload. Uses jsdom's real document. */
function pageWithBootstrap(): { win: FakeWindow, reload: ReturnType<typeof vi.fn> } {
    const reload = vi.fn()
    const win = { location: { hostname: 'localhost', protocol: 'http:', reload } } as unknown as FakeWindow
    new Function('window', consentBootstrapScript())(win)
    return { win, reload }
}

function calls(win: FakeWindow): unknown[][] {
    return (win.dataLayer ?? []).map(entry => Array.from(entry))
}

function commandIndex(win: FakeWindow, command: string, arg?: unknown): number {
    return calls(win).findIndex(call => call[0] === command && (arg === undefined || call[1] === arg))
}

function tagScripts(): HTMLScriptElement[] {
    return [...document.querySelectorAll<HTMLScriptElement>('script[data-google-tag]')]
}

function clearCookies(): void {
    for (const pair of document.cookie.split(';')) {
        const name = pair.split('=')[0]?.trim()
        if (name) {
            document.cookie = `${name}=; Path=/; Max-Age=0`
        }
    }
}

beforeEach(() => {
    clearCookies()
    for (const script of tagScripts()) {
        script.remove()
    }
})

describe('Google tag before consent', () => {
    it('starts with every signal denied and loads nothing', () => {
        const { win } = pageWithBootstrap()
        expect(calls(win)).to.deep.equal([
            ['consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                analytics_storage: 'denied',
                ad_personalization: 'denied'
            }],
            ['set', 'ads_data_redaction', true]
        ])
        expect(tagScripts()).to.have.length(0)
    })

    it('loads nothing on page load for an undecided visitor', () => {
        const { win } = pageWithBootstrap()
        expect(restoreConsent(TAG_IDS, win, document)).to.equal(undefined)
        expect(tagScripts()).to.have.length(0)
        expect(commandIndex(win, 'js')).to.equal(-1)
        expect(commandIndex(win, 'config')).to.equal(-1)
    })

    it('loads nothing on page load after a stored Decline', () => {
        document.cookie = 'fad_consent=denied; Path=/'
        const { win } = pageWithBootstrap()
        expect(restoreConsent(TAG_IDS, win, document)).to.equal('denied')
        expect(tagScripts()).to.have.length(0)
        expect(commandIndex(win, 'config')).to.equal(-1)
    })

    it('loads nothing when the build has no tag ids', () => {
        const { win } = pageWithBootstrap()
        grantConsent([], win, document)
        expect(tagScripts()).to.have.length(0)
        expect(commandIndex(win, 'config')).to.equal(-1)
    })
})

describe('Accept', () => {
    it('stores the choice, grants consent before config, then loads gtag.js once', () => {
        const { win } = pageWithBootstrap()
        grantConsent(TAG_IDS, win, document)

        expect(parseConsentCookie(document.cookie)).to.equal('granted')
        const update = commandIndex(win, 'consent', 'update')
        expect(calls(win)[update]).to.deep.equal(['consent', 'update', consentSignals('granted')])
        expect(update).to.be.lessThan(commandIndex(win, 'js'))
        expect(commandIndex(win, 'js')).to.be.lessThan(commandIndex(win, 'config'))
        expect(calls(win).filter(call => call[0] === 'config').map(call => call[1])).to.deep.equal(TAG_IDS)

        const scripts = tagScripts()
        expect(scripts).to.have.length(1)
        expect(scripts[0]!.src).to.equal('https://www.googletagmanager.com/gtag/js?id=AW-18541704359')
        expect(scripts[0]!.async).to.equal(true)
    })

    it('does not load gtag.js or queue config twice', () => {
        const { win } = pageWithBootstrap()
        grantConsent(TAG_IDS, win, document)
        grantConsent(TAG_IDS, win, document)
        expect(tagScripts()).to.have.length(1)
        expect(calls(win).filter(call => call[0] === 'config')).to.have.length(TAG_IDS.length)
    })

    it('loads the tag on the next page load, granted before config', () => {
        document.cookie = 'fad_consent=granted; Path=/'
        const { win } = pageWithBootstrap()
        expect(restoreConsent(TAG_IDS, win, document)).to.equal('granted')
        expect(tagScripts()).to.have.length(1)
        expect(commandIndex(win, 'consent', 'update')).to.be.lessThan(commandIndex(win, 'config'))
    })
})

describe('Decline and changing your mind', () => {
    it('Decline before anything loaded: stores the choice, no tag, no reload', () => {
        const { win, reload } = pageWithBootstrap()
        denyConsent(win, document)
        expect(parseConsentCookie(document.cookie)).to.equal('denied')
        expect(tagScripts()).to.have.length(0)
        expect(reload.mock.calls).to.have.length(0)
    })

    it('Accept, then Decline: denies, deletes Google cookies, keeps others, reloads without the tag', () => {
        const { win, reload } = pageWithBootstrap()
        grantConsent(TAG_IDS, win, document)
        document.cookie = '_ga=GA1.1.123; Path=/'
        document.cookie = '_gcl_au=1.1.456; Path=/'
        document.cookie = 'i18n_redirected=en-US; Path=/'

        denyConsent(win, document)

        expect(calls(win).at(-1)).to.deep.equal(['consent', 'update', consentSignals('denied')])
        expect(parseConsentCookie(document.cookie)).to.equal('denied')
        expect(document.cookie).to.not.match(/(^|;\s*)_ga=/)
        expect(document.cookie).to.not.match(/_gcl_au=/)
        expect(document.cookie).to.contain('i18n_redirected=en-US')
        expect(reload.mock.calls).to.have.length(1)
    })

    it('Decline, then Accept: loads the tag', () => {
        const { win } = pageWithBootstrap()
        denyConsent(win, document)
        grantConsent(TAG_IDS, win, document)
        expect(parseConsentCookie(document.cookie)).to.equal('granted')
        expect(tagScripts()).to.have.length(1)
    })

    it('never grants ad personalization on any path', () => {
        const { win } = pageWithBootstrap()
        grantConsent(TAG_IDS, win, document)
        denyConsent(win, document)
        grantConsent(TAG_IDS, win, document)
        const consentCalls = calls(win).filter(call => call[0] === 'consent')
        expect(consentCalls.length).to.be.greaterThan(2)
        for (const call of consentCalls) {
            expect((call[2] as { ad_personalization: string }).ad_personalization).to.equal('denied')
        }
    })
})

describe('consent cookie', () => {
    it('reads only a valid stored choice', () => {
        expect(parseConsentCookie('a=1; fad_consent=granted; b=2')).to.equal('granted')
        expect(parseConsentCookie('fad_consent=denied')).to.equal('denied')
        expect(parseConsentCookie('fad_consent=maybe')).to.equal(undefined)
        expect(parseConsentCookie('xfad_consent=granted')).to.equal(undefined)
        expect(parseConsentCookie('')).to.equal(undefined)
    })

    it('is shared with clinic subdomains on findadoc.jp only', () => {
        expect(consentCookie('granted', 'www.findadoc.jp', true))
            .to.equal('fad_consent=granted; Path=/; Max-Age=15552000; SameSite=Lax; Domain=.findadoc.jp; Secure')
        expect(consentCookie('denied', 'multilingual-online-clinic.findadoc.jp', true)).to.contain('Domain=.findadoc.jp')
        expect(consentCookie('denied', 'localhost', false))
            .to.equal('fad_consent=denied; Path=/; Max-Age=15552000; SameSite=Lax')
        expect(consentCookie('denied', 'notfindadoc.jp', true)).to.not.contain('Domain=')
    })
})
