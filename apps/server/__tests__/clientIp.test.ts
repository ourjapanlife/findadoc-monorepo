import { describe, expect, it } from 'vitest'
import { clientIpFrom } from '../src/clientIp.js'

const edge = { ip: '130.176.0.10' }

describe('clientIpFrom', () => {
    it('uses the CloudFront viewer address when the edge secret matches', () => {
        expect(clientIpFrom({
            ...edge,
            headers: { 'cloudfront-viewer-address': '203.0.113.7:46532', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBe('203.0.113.7')
        expect(clientIpFrom({
            ...edge,
            headers: { 'cloudfront-viewer-address': '2001:db8::1:46532', 'x-findadoc-edge': 's3cret' }
        }, 's3cret')).toBe('2001:db8::1')
    })

    it('ignores a viewer address without the right secret', () => {
        expect(clientIpFrom({
            ...edge,
            headers: { 'cloudfront-viewer-address': '203.0.113.7:46532', 'x-findadoc-edge': 'guess' }
        }, 's3cret')).toBe('130.176.0.10')
        expect(clientIpFrom({ ...edge, headers: { 'cloudfront-viewer-address': '203.0.113.7:1' } }, 's3cret'))
            .toBe('130.176.0.10')
        expect(clientIpFrom({ ...edge, headers: { 'cloudfront-viewer-address': '203.0.113.7:1' } }, undefined))
            .toBe('130.176.0.10')
    })
})
