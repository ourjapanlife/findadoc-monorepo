import { expect } from 'chai'
import { PAYMENT_QR_MAX_BYTES, isAcceptedQrFile, isHttpsLink, parseFeeJpy } from '@/utils/booking/paymentSettings'

describe('payment settings form checks', () => {
    it('reads a blank fee as no fee, and a whole number of yen as the fee', () => {
        expect(parseFeeJpy('')).to.equal(null)
        expect(parseFeeJpy('  ')).to.equal(null)
        expect(parseFeeJpy('0')).to.equal(0)
        expect(parseFeeJpy(' 5000 ')).to.equal(5000)
    })

    it('refuses a negative, decimal, or non-numeric fee', () => {
        for (const value of ['-1', '1.5', '5,000', '¥5000', 'abc', '1e3']) {
            expect(parseFeeJpy(value), value).to.equal(undefined)
        }
    })

    it('accepts https links only', () => {
        expect(isHttpsLink('https://example.com/pay')).to.equal(true)
        for (const value of ['http://example.com/pay', 'javascript:alert(1)', 'example.com', '']) {
            expect(isHttpsLink(value), value).to.equal(false)
        }
    })

    it('accepts a PNG, JPEG, or WebP QR up to 1 MB', () => {
        expect(isAcceptedQrFile({ type: 'image/png', size: 2048 })).to.equal(true)
        expect(isAcceptedQrFile({ type: 'image/webp', size: PAYMENT_QR_MAX_BYTES })).to.equal(true)
        expect(isAcceptedQrFile({ type: 'image/jpeg', size: PAYMENT_QR_MAX_BYTES + 1 })).to.equal(false)
        expect(isAcceptedQrFile({ type: 'image/svg+xml', size: 100 })).to.equal(false)
        expect(isAcceptedQrFile({ type: 'image/png', size: 0 })).to.equal(false)
    })
})
