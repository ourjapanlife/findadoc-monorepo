import { describe, expect, it } from 'vitest'
import { PaymentType, type PaymentOptionsInput } from '@findadoc/graphql'
import { ErrorCode, type Result } from '../src/result.js'
import {
    validateCreateFacilityInput,
    validatePaymentOptions,
    validateUpdateFacilityInput
} from '../src/validation/validateFacility.js'
import { validateUpdateSubmissionInput } from '../src/validation/validateSubmissions.js'
import { paymentOptionFields } from '../src/services/mappersEntityService.js'
import { buildFacilityUpdatePatch } from '../src/services/facilityService.js'

function check(options: PaymentOptionsInput[] | null | undefined) {
    const result: Result<unknown> = { data: undefined, hasErrors: false, errors: [] }
    validatePaymentOptions(options, result)
    return result.errors?.map(error => [error.field, error.errorCode])
}

function paymentErrors(result: Result<unknown>, field = 'paymentOptions') {
    return (result.errors ?? []).filter(error => error.field === field).map(error => error.errorCode)
}

describe('validatePaymentOptions', () => {
    it('allows unknown', () => {
        expect(check(undefined)).toEqual([])
        expect(check(null)).toEqual([])
        expect(check([])).toEqual([])
    })

    it('allows types with brands from the controlled list', () => {
        expect(check([
            { paymentType: PaymentType.Cash },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'Mastercard'] }
        ])).toEqual([])
    })

    it('refuses a brand outside the controlled list', () => {
        expect(check([{ paymentType: PaymentType.CreditCard, paymentBrands: ['Discover'] }]))
            .toEqual([['paymentOptions', ErrorCode.INVALID_INPUT]])
    })

    it('refuses a type sent twice', () => {
        expect(check([{ paymentType: PaymentType.Cash }, { paymentType: PaymentType.Cash }]))
            .toEqual([['paymentOptions', ErrorCode.INVALID_INPUT]])
    })

    it('refuses a list longer than the number of types', () => {
        const options = Array.from({ length: 6 }, () => ({ paymentType: PaymentType.Cash }))
        expect(check(options)).toEqual([['paymentOptions', ErrorCode.INVALID_LENGTH_TOO_LONG]])
    })
})

describe('facility and submission inputs', () => {
    const badBrand = [{ paymentType: PaymentType.QrCode, paymentBrands: ['Visa'] }]

    it('checks payment on create and update', () => {
        expect(paymentErrors(validateCreateFacilityInput({
            nameEn: 'Fake Clinic',
            nameJa: 'フェイククリニック',
            online: true,
            contact: { phone: '', email: '', website: '' },
            healthcareProfessionalIds: [],
            paymentOptions: badBrand
        }))).toEqual([ErrorCode.INVALID_INPUT])
        expect(paymentErrors(validateUpdateFacilityInput({ paymentOptions: badBrand })))
            .toEqual([ErrorCode.INVALID_INPUT])
    })

    it('checks payment on the facility a submission approves', () => {
        const result = validateUpdateSubmissionInput({
            facility: {
                nameEn: 'Fake Clinic',
                nameJa: 'フェイククリニック',
                contact: { phone: '', email: '', website: '' },
                healthcareProfessionalIds: [],
                paymentOptions: badBrand
            }
        })
        expect(paymentErrors(result, 'facility.paymentOptions')).toEqual([ErrorCode.INVALID_INPUT])
    })
})

describe('paymentOptionFields', () => {
    it('reads an empty or broken column as unknown', () => {
        expect(paymentOptionFields({})).toEqual({ paymentOptions: [] })
        expect(paymentOptionFields({ payment_options: 'not json' })).toEqual({ paymentOptions: [] })
        expect(paymentOptionFields({ payment_options: '[]' })).toEqual({ paymentOptions: [] })
    })

    it('hides a legacy insurance entry and free-text brands', () => {
        expect(paymentOptionFields({
            payment_options: JSON.stringify([
                { paymentType: 'INSURANCE', paymentBrands: ['Japanese health insurance'] },
                { paymentType: 'QR_CODE', paymentBrands: ['PayPay', 'LINE Pay'] }
            ])
        })).toEqual({ paymentOptions: [{ paymentType: PaymentType.QrCode, paymentBrands: ['PayPay'] }] })
    })
})

describe('buildFacilityUpdatePatch', () => {
    it('stores the list in display order', () => {
        const patch = buildFacilityUpdatePatch({
            paymentOptions: [
                { paymentType: PaymentType.CreditCard, paymentBrands: ['JCB', 'Visa'] },
                { paymentType: PaymentType.Cash }
            ]
        })
        expect(JSON.parse(String(patch.payment_options))).toEqual([
            { paymentType: PaymentType.Cash, paymentBrands: [] },
            { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'JCB'] }
        ])
    })

    it('clears the answer back to unknown with null or an empty list', () => {
        expect(buildFacilityUpdatePatch({ paymentOptions: null }).payment_options).toBe('[]')
        expect(buildFacilityUpdatePatch({ paymentOptions: [] }).payment_options).toBe('[]')
    })

    it('leaves payment alone when the update does not send it', () => {
        expect(buildFacilityUpdatePatch({ nameEn: 'Fake Clinic' })).not.toHaveProperty('payment_options')
    })
})
