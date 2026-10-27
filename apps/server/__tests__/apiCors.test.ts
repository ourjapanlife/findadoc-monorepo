import { describe, expect, it } from 'vitest'
import { isAllowedApiOrigin } from '../src/apiCors.js'

const production = { isLocal: false, websiteURL: 'https://www.findadoc.jp' }

describe('API CORS origins', () => {
    it('allows the production site and an Amplify branch for main or a pull request', () => {
        expect(isAllowedApiOrigin('https://www.findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('https://findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('https://main.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(true)
        expect(isAllowedApiOrigin('https://pr-12.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(true)
    })

    it('rejects other Amplify branches, lookalike hosts, and retired Netlify hosts', () => {
        expect(isAllowedApiOrigin('https://dev.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(false)
        expect(isAllowedApiOrigin('http://pr-12.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(false)
        expect(isAllowedApiOrigin('https://pr-12.d1m7bkiki6tdw1.amplifyapp.com.evil.example', production)).toBe(false)
        expect(isAllowedApiOrigin('https://pr-12.not-an-app.amplifyapp.com', production)).toBe(false)
        expect(isAllowedApiOrigin('https://findadoc-monorepo-web.netlify.app', production)).toBe(false)
        expect(isAllowedApiOrigin('https://deploy-preview-12--findadoc-monorepo-web.netlify.app', production)).toBe(false)
        expect(isAllowedApiOrigin(undefined, production)).toBe(false)
    })

    it('allows every hostname we own under findadoc.jp', () => {
        expect(isAllowedApiOrigin('https://multilingual-online-clinic.findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('https://api.findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('https://docs.findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('http://multilingual-online-clinic.findadoc.jp', production)).toBe(false)
        expect(isAllowedApiOrigin('https://a.multilingual-online-clinic.findadoc.jp', production)).toBe(false)
        expect(isAllowedApiOrigin('https://multilingual-online-clinic.findadoc.jp.evil.example', production)).toBe(false)
        expect(isAllowedApiOrigin('https://-bad.findadoc.jp', production)).toBe(false)
        expect(isAllowedApiOrigin('https://Clinic.findadoc.jp', production)).toBe(false)
        expect(isAllowedApiOrigin('https://multilingual-online-clinic.findadoc.jp:8443', production)).toBe(false)
    })

    it('allows a local browser only outside production', () => {
        const local = { isLocal: true, websiteURL: undefined }
        expect(isAllowedApiOrigin('http://localhost:3000', production)).toBe(true)
        expect(isAllowedApiOrigin('http://localhost:5173', production)).toBe(false)
        expect(isAllowedApiOrigin('http://localhost:5173', local)).toBe(true)
        expect(isAllowedApiOrigin('http://multilingual-online-clinic.localhost:3000', production)).toBe(false)
        expect(isAllowedApiOrigin('http://multilingual-online-clinic.localhost:3000', local)).toBe(true)
        expect(isAllowedApiOrigin('http://a.b.localhost:3000', local)).toBe(false)
    })
})
