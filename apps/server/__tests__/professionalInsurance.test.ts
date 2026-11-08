import { describe, expect, it } from 'vitest'
import {
    OldInsuranceCode,
    describeStoredInsurance,
    insuranceShape,
    planStoredInsurance,
    reportStoredInsurance,
    storedCodes
} from '../src/insurance/professionalInsurance.js'

const clinic = { name: 'Minato Dental', city: 'Minato', japaneseInsurance: null }

describe('planStoredInsurance', () => {
    it('clears the dual default and leaves the facility unknown', () => {
        const plan = planStoredInsurance({
            acceptedInsurance: [OldInsuranceCode.JapaneseHealthInsurance, OldInsuranceCode.Uninsured],
            facilities: [clinic]
        })

        expect(plan).toEqual({
            action: 'clear',
            shape: 'dual_default',
            sentences: ['Takes Japanese health insurance', 'Sees uninsured / self-pay patients'],
            recommendation: 'Clear both codes and leave the facility unknown until a moderator marks it.'
        })
    })

    it('lists a single code the same way instead of keeping it', () => {
        const plan = planStoredInsurance({
            acceptedInsurance: [OldInsuranceCode.JapaneseHealthInsurance],
            facilities: [clinic]
        })

        expect(plan.action).toBe('clear')
        expect(plan.action === 'clear' && plan.shape).toBe('japanese_only')
    })

    it('keeps the answer the facility already has', () => {
        const plan = planStoredInsurance({
            acceptedInsurance: [OldInsuranceCode.JapaneseHealthInsurance, OldInsuranceCode.Uninsured],
            facilities: [{ ...clinic, japaneseInsurance: 'ACCEPTED' }]
        })

        expect(plan.action === 'clear' && plan.recommendation).toBe(
            'Clear both codes and keep the facility answer (the clinic is marked as taking Japanese public insurance).'
        )
    })

    it('flags an old "does not accept insurance" on a clinic marked yes', () => {
        const plan = planStoredInsurance({
            acceptedInsurance: [OldInsuranceCode.InsuranceNotAccepted],
            facilities: [{ ...clinic, japaneseInsurance: 'ACCEPTED' }]
        })

        expect(plan.action === 'clear' && plan.recommendation).toBe(
            'Clear the codes and keep the facility answer (the clinic is marked as taking Japanese public insurance).'
            + ' Check the clinic: an old code said it does not accept insurance.'
            + ' If it is self-pay only, mark it so.'
        )
    })

    it('flags an old "does not accept insurance" on a clinic that is still unknown', () => {
        const plan = planStoredInsurance({
            acceptedInsurance: [OldInsuranceCode.InsuranceNotAccepted],
            facilities: [clinic]
        })

        expect(plan.action === 'clear' && plan.recommendation).toBe(
            'Clear the codes and leave the facility unknown until a moderator marks it.'
            + ' Check the clinic: an old code said it does not accept insurance.'
            + ' If it is self-pay only, mark it so.'
        )
    })

    it('does not flag a clinic already marked self-pay only', () => {
        const plan = planStoredInsurance({
            acceptedInsurance: [OldInsuranceCode.InsuranceNotAccepted],
            facilities: [{ ...clinic, japaneseInsurance: 'NOT_ACCEPTED' }]
        })

        expect(plan.action === 'clear' && plan.recommendation).toBe(
            'Clear the codes and keep the facility answer (the clinic is marked as self-pay only).'
        )
    })

    it('does nothing to an empty list', () => {
        expect(planStoredInsurance({ acceptedInsurance: [], facilities: [clinic] })).toEqual({ action: 'keep' })
        expect(planStoredInsurance({ acceptedInsurance: null, facilities: [] })).toEqual({ action: 'keep' })
    })

    it('reads a JSON string and names a code it does not know', () => {
        expect(storedCodes('["TRAVEL_INSURANCE","SOMETHING"]')).toEqual(['TRAVEL_INSURANCE', 'SOMETHING'])
        const plan = planStoredInsurance({ acceptedInsurance: '["SOMETHING"]', facilities: [] })
        expect(plan.action === 'clear' && plan.sentences).toEqual(['Unrecognised code SOMETHING'])
    })
})

describe('reportStoredInsurance', () => {
    it('counts each shape', () => {
        const report = reportStoredInsurance([
            {
                acceptedInsurance: [OldInsuranceCode.Uninsured, OldInsuranceCode.JapaneseHealthInsurance],
                facilities: []
            },
            { acceptedInsurance: [OldInsuranceCode.JapaneseHealthInsurance], facilities: [] },
            { acceptedInsurance: [OldInsuranceCode.Uninsured], facilities: [] },
            { acceptedInsurance: [OldInsuranceCode.TravelInsurance], facilities: [] },
            { acceptedInsurance: [], facilities: [] }
        ])

        expect(report).toEqual({
            total: 5,
            withCodes: 4,
            shapes: { dual_default: 1, japanese_only: 1, uninsured_only: 1, other: 1 }
        })
    })

    it('treats the pair plus another code as other', () => {
        expect(insuranceShape([
            OldInsuranceCode.JapaneseHealthInsurance,
            OldInsuranceCode.Uninsured,
            OldInsuranceCode.TravelInsurance
        ])).toBe('other')
    })
})

describe('describeStoredInsurance', () => {
    it('prints the id, facility, city, and sentences without a personal name', () => {
        const row = {
            acceptedInsurance: [OldInsuranceCode.JapaneseHealthInsurance, OldInsuranceCode.Uninsured],
            facilities: [clinic]
        }
        const plan = planStoredInsurance(row)
        if (plan.action !== 'clear') {
            throw new Error('expected a clear plan')
        }

        expect(describeStoredInsurance('hp-1', row, plan)).toBe([
            '[hp-1] at Minato Dental (Minato)',
            '  stored: Takes Japanese health insurance; Sees uninsured / self-pay patients',
            '  recommendation: Clear both codes and leave the facility unknown until a moderator marks it.'
        ].join('\n'))
    })
})
