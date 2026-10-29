import { describe, expect, it } from 'vitest'
import { clientIpFrom, viewerCountryFrom } from './clientIp.js'

const edge = { ip: '130.176.0.10' }

describe('clientIpFrom', () => {
    it('uses the viewer address CloudFront sends when the edge secret matches', () => {
        expect(clientIpFrom({
            ...edge,
            headers: { 'x-findadoc-viewer-ip': '203.0.113.7', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBe('203.0.113.7')
        expect(clientIpFrom({
            ...edge,
            headers: { 'x-findadoc-viewer-ip': '2001:db8::1', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBe('2001:db8::1')
    })

    it('ignores a viewer address without the right secret', () => {
        expect(clientIpFrom({
            ...edge,
            headers: { 'x-findadoc-viewer-ip': '203.0.113.7', 'x-findadoc-edge': 'guess' }
        }, 's3cret')).toBe('130.176.0.10')
        expect(clientIpFrom({ ...edge, headers: { 'x-findadoc-viewer-ip': '203.0.113.7' } }, 's3cret'))
            .toBe('130.176.0.10')
        expect(clientIpFrom({ ...edge, headers: { 'x-findadoc-viewer-ip': '203.0.113.7' } }, undefined))
            .toBe('130.176.0.10')
        expect(clientIpFrom({
            ...edge,
            headers: { 'x-findadoc-viewer-ip': '203.0.113.7', 'x-findadoc-edge': 's3creT' }
        }, 's3cret')).toBe('130.176.0.10')
        expect(clientIpFrom({}, 's3cret')).toBe('unknown')
    })
})

describe('viewerCountryFrom', () => {
    it('uses the country CloudFront sends when the edge secret matches', () => {
        expect(viewerCountryFrom({
            headers: { 'x-findadoc-viewer-country': 'JP', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBe('JP')
        expect(viewerCountryFrom({
            headers: { 'x-findadoc-viewer-country': 'de', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBe('DE')
    })

    it('ignores a country without the right secret, or one that is not a country code', () => {
        expect(viewerCountryFrom({
            headers: { 'x-findadoc-viewer-country': 'JP', 'x-findadoc-edge': 'guess' }
        }, 's3cret')).toBeUndefined()
        expect(viewerCountryFrom({ headers: { 'x-findadoc-viewer-country': 'JP' } }, 's3cret')).toBeUndefined()
        expect(viewerCountryFrom({
            headers: { 'x-findadoc-viewer-country': 'JP', 'x-findadoc-edge': 's3cret' }
        }, undefined)).toBeUndefined()
        expect(viewerCountryFrom({
            headers: { 'x-findadoc-viewer-country': 'Japan', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBeUndefined()
        expect(viewerCountryFrom({ headers: { 'x-findadoc-edge': 's3cret' } }, 's3cret')).toBeUndefined()
    })
})
