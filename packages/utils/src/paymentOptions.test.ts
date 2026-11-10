import { PaymentType } from '@findadoc/graphql'
import { describe, expect, it } from 'vitest'
import { normalizePaymentOptions, paymentOptionsProblem, PAYMENT_TYPE_BRANDS, PAYMENT_TYPES } from './paymentOptions.js'

describe('paymentOptionsProblem', () => {
    it('accepts an empty list as unknown', () => {
        expect(paymentOptionsProblem([])).toBeNull()
    })

    it('accepts controlled brands under the type that names them', () => {
        expect(paymentOptionsProblem([
            { paymentType: PaymentType.Cash, paymentBrands: [] },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'JCB'] },
            { paymentType: PaymentType.ElectronicMoney, paymentBrands: ['IC'] },
            { paymentType: PaymentType.QrCode, paymentBrands: ['PayPay'] }
        ])).toBeNull()
    })

    it('refuses a free-text brand or a brand under the wrong type', () => {
        expect(paymentOptionsProblem([{ paymentType: PaymentType.ElectronicMoney, paymentBrands: ['Suica'] }]))
            .toBe('unknown_brand')
        expect(paymentOptionsProblem([{ paymentType: PaymentType.QrCode, paymentBrands: ['Visa'] }]))
            .toBe('unknown_brand')
        expect(paymentOptionsProblem([{ paymentType: PaymentType.Cash, paymentBrands: ['Other'] }]))
            .toBe('unknown_brand')
    })

    it('refuses a repeated type, a repeated brand, or an unknown type', () => {
        expect(paymentOptionsProblem([
            { paymentType: PaymentType.Cash },
            { paymentType: PaymentType.Cash }
        ])).toBe('duplicate_type')
        expect(paymentOptionsProblem([{ paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'Visa'] }]))
            .toBe('duplicate_brand')
        expect(paymentOptionsProblem([{ paymentType: 'INSURANCE' as PaymentType }])).toBe('unknown_type')
    })

    it('refuses a list longer than the number of types', () => {
        const tooMany = [...PAYMENT_TYPES, PaymentType.Cash].map(paymentType => ({ paymentType }))
        expect(paymentOptionsProblem(tooMany)).toBe('too_many')
    })
})

describe('normalizePaymentOptions', () => {
    it('reads anything that is not a list as unknown', () => {
        expect(normalizePaymentOptions(null)).toEqual([])
        expect(normalizePaymentOptions(undefined)).toEqual([])
        expect(normalizePaymentOptions('[]')).toEqual([])
    })

    it('drops legacy types and free-text brands instead of showing them', () => {
        expect(normalizePaymentOptions([
            { paymentType: 'INSURANCE', paymentBrands: ['Japanese health insurance'] },
            { paymentType: 'ELECTRONIC_MONEY', paymentBrands: ['Suica', 'IC'] }
        ])).toEqual([{ paymentType: PaymentType.ElectronicMoney, paymentBrands: ['IC'] }])
    })

    it('puts types and brands in display order and merges a repeated type', () => {
        expect(normalizePaymentOptions([
            { paymentType: PaymentType.CreditCard, paymentBrands: ['JCB'] },
            { paymentType: PaymentType.Cash, paymentBrands: null },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'JCB'] }
        ])).toEqual([
            { paymentType: PaymentType.Cash, paymentBrands: [] },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'JCB'] }
        ])
    })

    it('names every type in the brand table', () => {
        expect(Object.keys(PAYMENT_TYPE_BRANDS).sort()).toEqual([...PAYMENT_TYPES].sort())
    })
})
