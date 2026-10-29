/* eslint-disable camelcase -- Google consent mode field names (ad_storage, wait_for_update). */
/// <reference types="vitest/globals" />
import { expect } from 'chai'
import {
    consentBootstrapScript,
    consentCookie,
    consentSignals,
    CONSENT_REQUIRED_REGIONS,
    isConsentRegionTimeZone,
    parseConsentCookie
} from '@/utils/consent'

/** Runs the <head> script against a stand-in window and returns the gtag calls it queued. */
function runBootstrap(cookie: string): unknown[][] {
    const fakeWindow: { dataLayer?: IArguments[] } = {}
    new Function('window', 'document', consentBootstrapScript())(fakeWindow, { cookie })
    return (fakeWindow.dataLayer ?? []).map(entry => Array.from(entry))
}

describe('Google consent mode', () => {
    it('never grants ad personalization', () => {
        expect(consentSignals('granted').ad_personalization).to.equal('denied')
        expect(consentSignals('denied')).to.deep.equal({
            ad_storage: 'denied',
            ad_user_data: 'denied',
            analytics_storage: 'denied',
            ad_personalization: 'denied'
        })
    })

    it('reads only a valid stored choice', () => {
        expect(parseConsentCookie('a=1; fad_consent=granted; b=2')).to.equal('granted')
        expect(parseConsentCookie('fad_consent=denied')).to.equal('denied')
        expect(parseConsentCookie('fad_consent=maybe')).to.equal(undefined)
        expect(parseConsentCookie('xfad_consent=granted')).to.equal(undefined)
        expect(parseConsentCookie('')).to.equal(undefined)
    })

    it('shares the cookie with clinic subdomains on findadoc.jp only', () => {
        expect(consentCookie('granted', 'www.findadoc.jp', true))
            .to.equal('fad_consent=granted; Path=/; Max-Age=15552000; SameSite=Lax; Domain=.findadoc.jp; Secure')
        expect(consentCookie('denied', 'multilingual-online-clinic.findadoc.jp', true)).to.contain('Domain=.findadoc.jp')
        expect(consentCookie('denied', 'localhost', false))
            .to.equal('fad_consent=denied; Path=/; Max-Age=15552000; SameSite=Lax')
        expect(consentCookie('denied', 'notfindadoc.jp', true)).to.not.contain('Domain=')
    })

    it('opens the banner on its own for European time zones', () => {
        expect(isConsentRegionTimeZone('Europe/Paris')).to.equal(true)
        expect(isConsentRegionTimeZone('Atlantic/Reykjavik')).to.equal(true)
        expect(isConsentRegionTimeZone('Asia/Tokyo')).to.equal(false)
        expect(isConsentRegionTimeZone('America/New_York')).to.equal(false)
        expect(isConsentRegionTimeZone(undefined)).to.equal(false)
    })

    it('covers the EEA, the UK, and Switzerland', () => {
        expect(CONSENT_REQUIRED_REGIONS).to.have.length(32)
        for (const code of ['FR', 'DE', 'NO', 'IS', 'LI', 'GB', 'CH']) {
            expect(CONSENT_REQUIRED_REGIONS).to.include(code)
        }
        expect(CONSENT_REQUIRED_REGIONS).to.not.include('JP')
    })

    it('queues the region default, the global default, and redaction before the tag', () => {
        const calls = runBootstrap('')
        expect(calls).to.have.length(3)
        expect(calls[0]).to.deep.equal(['consent', 'default', {
            ...consentSignals('denied'),
            region: [...CONSENT_REQUIRED_REGIONS],
            wait_for_update: 500
        }])
        expect(calls[1]).to.deep.equal(['consent', 'default', consentSignals('granted')])
        expect(calls[2]).to.deep.equal(['set', 'ads_data_redaction', true])
    })

    it('replays a stored choice before the tag', () => {
        expect(runBootstrap('fad_consent=denied').at(-1))
            .to.deep.equal(['consent', 'update', consentSignals('denied')])
        expect(runBootstrap('x=1; fad_consent=granted').at(-1))
            .to.deep.equal(['consent', 'update', consentSignals('granted')])
    })
})
