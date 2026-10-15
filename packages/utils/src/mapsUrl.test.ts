import { describe, expect, it } from 'vitest'
import { validateGoogleMapsUrlInput } from './mapsUrl.js'

describe('validateGoogleMapsUrlInput', () => {
    it('accepts full google.com/maps place URLs', () => {
        expect(validateGoogleMapsUrlInput('https://www.google.com/maps/place/Some+Clinic')).toBe(true)
    })

    it('accepts google.co.jp/maps URLs', () => {
        expect(validateGoogleMapsUrlInput('https://www.google.co.jp/maps/place/Some+Clinic')).toBe(true)
    })

    it('accepts maps.google.com URLs', () => {
        expect(validateGoogleMapsUrlInput('https://maps.google.com/?q=Some+Clinic')).toBe(true)
    })

    it('accepts maps.app.goo.gl share links', () => {
        expect(validateGoogleMapsUrlInput('https://maps.app.goo.gl/abc123XYZ')).toBe(true)
    })

    it('accepts legacy goo.gl/maps share links', () => {
        expect(validateGoogleMapsUrlInput('https://goo.gl/maps/abc123XYZ')).toBe(true)
    })

    it('trims surrounding whitespace before validating', () => {
        expect(validateGoogleMapsUrlInput('  https://maps.app.goo.gl/abc123XYZ  ')).toBe(true)
    })

    it('rejects a non-google https URL', () => {
        expect(validateGoogleMapsUrlInput('https://example.com')).toBe(false)
    })

    it('rejects a non-https URL', () => {
        expect(validateGoogleMapsUrlInput('http://example.com')).toBe(false)
    })

    it('rejects an empty string', () => {
        expect(validateGoogleMapsUrlInput('')).toBe(false)
    })
})
