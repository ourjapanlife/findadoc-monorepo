import { describe, expect, it } from 'vitest'
import { isAllowedApiOrigin } from '../src/apiCors.js'

const production = { isLocal: false, websiteURL: 'https://www.findadoc.jp' }

describe('API CORS origins', () => {
    it('allows the production site and an Amplify branch for main or a pull request', () => {
        expect(isAllowedApiOrigin('https://www.findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('https://findadoc.jp', production)).toBe(true)
        expect(isAllowedApiOrigin('https://main.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(true)
        expect(isAllowedApiOrigin('https://pr-12.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(true)
        expect(isAllowedApiOrigin('https://deploy-preview-12--findadoc-monorepo-web.netlify.app', production)).toBe(true)
    })

    it('rejects other Amplify branches and lookalike hosts', () => {
        expect(isAllowedApiOrigin('https://dev.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(false)
        expect(isAllowedApiOrigin('http://pr-12.d1m7bkiki6tdw1.amplifyapp.com', production)).toBe(false)
        expect(isAllowedApiOrigin('https://pr-12.d1m7bkiki6tdw1.amplifyapp.com.evil.example', production)).toBe(false)
        expect(isAllowedApiOrigin('https://pr-12.not-an-app.amplifyapp.com', production)).toBe(false)
        expect(isAllowedApiOrigin(undefined, production)).toBe(false)
    })

    it('allows a local browser only outside production', () => {
        expect(isAllowedApiOrigin('http://localhost:3000', production)).toBe(true)
        expect(isAllowedApiOrigin('http://localhost:5173', production)).toBe(false)
        expect(isAllowedApiOrigin('http://localhost:5173', { isLocal: true, websiteURL: undefined })).toBe(true)
    })
})
