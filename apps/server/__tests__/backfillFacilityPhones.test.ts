import { describe, expect, it } from 'vitest'
import { PHONE_PLAN, planFacilityPhone, reportFacilityPhones } from '../utils/backfillFacilityPhones.js'

const FACILITY_A = '00000000-0000-4000-8000-00000000000a'
const FACILITY_B = '00000000-0000-4000-8000-00000000000b'
const FACILITY_C = '00000000-0000-4000-8000-00000000000c'
const FACILITY_D = '00000000-0000-4000-8000-00000000000d'
const FACILITY_E = '00000000-0000-4000-8000-00000000000e'

describe('facility phone backfill', () => {
    it('rewrites a national or spaced number to E.164', () => {
        expect(planFacilityPhone({ id: FACILITY_A, phone: '03-5722-5500' })).toEqual({
            id: FACILITY_A,
            action: PHONE_PLAN.NORMALIZE,
            current: '03-5722-5500',
            next: '+81357225500'
        })
        expect(planFacilityPhone({ id: FACILITY_A, phone: '+81 045-641-6961' }).next).toBe('+81456416961')
    })

    it('leaves an E.164 number and an empty phone alone', () => {
        expect(planFacilityPhone({ id: FACILITY_B, phone: '+81357225500' }).action).toBe(PHONE_PLAN.ALREADY_E164)
        expect(planFacilityPhone({ id: FACILITY_C, phone: '' }).action).toBe(PHONE_PLAN.EMPTY)
        expect(planFacilityPhone({ id: FACILITY_C, phone: null }).action).toBe(PHONE_PLAN.EMPTY)
    })

    it('does not guess at a number that does not parse', () => {
        const plan = planFacilityPhone({ id: FACILITY_D, phone: '03-5722-5500 (reception)' })
        expect(plan).toEqual({ id: FACILITY_D, action: PHONE_PLAN.UNPARSEABLE })
    })

    it('reports counts and ids without any phone number', () => {
        const report = reportFacilityPhones([
            planFacilityPhone({ id: FACILITY_A, phone: '03-5722-5500' }),
            planFacilityPhone({ id: FACILITY_B, phone: '+81357225500' }),
            planFacilityPhone({ id: FACILITY_C, phone: '' }),
            planFacilityPhone({ id: FACILITY_D, phone: 'none' }),
            planFacilityPhone({ id: FACILITY_E, phone: '+1 212 555 0100' })
        ])
        expect(report).toEqual({
            total: 5,
            empty: 1,
            alreadyE164: 1,
            normalize: 1,
            unparseable: 2,
            unparseableIds: [FACILITY_D, FACILITY_E]
        })
        expect(JSON.stringify(report)).not.toMatch(/5722|555/)
    })
})
