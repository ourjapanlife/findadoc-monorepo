import { describe, it } from 'vitest'
import { expect } from 'chai'
import {
    AUTH0_API_AUDIENCE,
    buildLoginRoute,
    getAuth0ClientOptions,
    isAuth0ConsentRequiredError,
    resolveAuthReturnPath,
    sanitizeAuthReturnPath
} from '@/utils/auth0Config'

describe('sanitizeAuthReturnPath', () => {
    it('rejects external and login paths', () => {
        expect(sanitizeAuthReturnPath('//evil.com')).to.equal(null)
        expect(sanitizeAuthReturnPath('/login')).to.equal(null)
        expect(sanitizeAuthReturnPath('/login?returnTo=/')).to.equal(null)
    })

    it('allows internal app paths', () => {
        expect(sanitizeAuthReturnPath('/')).to.equal('/')
        expect(sanitizeAuthReturnPath('/my-page?view=settings')).to.equal('/my-page?view=settings')
    })
})

describe('resolveAuthReturnPath', () => {
    it('uses returnTo on the login page', () => {
        expect(resolveAuthReturnPath('/login?returnTo=%2Fmy-page')).to.equal('/my-page')
        expect(resolveAuthReturnPath('/login?returnTo=%2Fmy-page%3Fview%3Dsettings'))
            .to.equal('/my-page?view=settings')
    })

    it('falls back to home when login has no return target', () => {
        expect(resolveAuthReturnPath('/login')).to.equal('/')
        expect(resolveAuthReturnPath('/login?foo=bar')).to.equal('/')
    })

    it('preserves the current route outside login', () => {
        expect(resolveAuthReturnPath('/my-page')).to.equal('/my-page')
        expect(resolveAuthReturnPath('/my-page?view=settings')).to.equal('/my-page?view=settings')
    })
})

describe('getAuth0ClientOptions', () => {
    it('keeps the token cache on localhost so a reload can restore the session', () => {
        const options = getAuth0ClientOptions('http://localhost:3000')

        expect(options.cacheLocation).to.equal('localstorage')
        expect(getAuth0ClientOptions('http://127.0.0.1:3000').cacheLocation).to.equal('localstorage')
        expect(options.authorizationParams.audience).to.equal(AUTH0_API_AUDIENCE)
        expect(options.authorizationParams.redirect_uri).to.equal('http://localhost:3000')
    })

    it('leaves the production cache in memory', () => {
        expect(getAuth0ClientOptions('https://findadoc.jp').cacheLocation).to.equal('memory')
    })
})

describe('buildLoginRoute', () => {
    it('encodes the current page as returnTo', () => {
        expect(buildLoginRoute('/my-page?view=settings')).to.deep.equal({
            path: '/login',
            query: { returnTo: '/my-page?view=settings' }
        })
    })
})

describe('isAuth0ConsentRequiredError', () => {
    it('detects consent_required from Auth0 error payload', () => {
        expect(isAuth0ConsentRequiredError({
            error: 'consent_required',
            error_description: 'Consent required' // eslint-disable-line camelcase
        })).to.be.true
    })

    it('returns false for unrelated errors', () => {
        expect(isAuth0ConsentRequiredError({ error: 'login_required' })).to.be.false
        expect(isAuth0ConsentRequiredError(null)).to.be.false
    })
})
