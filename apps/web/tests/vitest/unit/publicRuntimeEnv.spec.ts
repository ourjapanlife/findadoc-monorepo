import { afterEach, describe, expect, it } from 'vitest'
import { isGoogleMapsApiKey, isSentryDsn, publicRuntimeValue } from '~/utils/nuxt/publicRuntimeEnv'

describe('public runtime env', () => {
    afterEach(() => {
        delete process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY
        delete process.env.GOOGLE_MAPS_API_KEY
        delete process.env.NUXT_PUBLIC_SENTRY_DSN
    })

    it('keeps an empty string when the variable is missing', () => {
        expect(publicRuntimeValue('NUXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_API_KEY')).toBe('')
    })

    it('does not return the variable name', () => {
        process.env.NUXT_PUBLIC_SENTRY_DSN = 'NUXT_PUBLIC_SENTRY_DSN'
        expect(publicRuntimeValue('NUXT_PUBLIC_SENTRY_DSN')).toBe('')
        expect(isSentryDsn('NUXT_PUBLIC_SENTRY_DSN')).toBe(false)
        expect(isGoogleMapsApiKey('NUXT_PUBLIC_GOOGLE_MAPS_API_KEY')).toBe(false)
    })

    it('reads the Nuxt name and the older Maps name', () => {
        process.env.GOOGLE_MAPS_API_KEY = 'AIzaLegacy'
        expect(publicRuntimeValue('NUXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_API_KEY')).toBe('AIzaLegacy')

        process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'AIzaNuxt'
        expect(publicRuntimeValue('NUXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_API_KEY')).toBe('AIzaNuxt')
    })

    it('accepts a real Sentry DSN and a real Maps key', () => {
        expect(isSentryDsn('https://abc@o123.ingest.sentry.io/456')).toBe(true)
        expect(isGoogleMapsApiKey('AIzaSyExample')).toBe(true)
    })
})
