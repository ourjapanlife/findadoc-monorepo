import { describe, expect, it } from 'vitest'
import { JapaneseInsurance } from '@findadoc/graphql'
import { ErrorCode, type Result } from '../src/result.js'
import { validateJapaneseInsurance } from '../src/validation/validateFacility.js'
import { japaneseInsuranceFields } from '../src/services/mappersEntityService.js'
import { canReadModeratorNotes, Role, type User } from '../src/auth.js'
import { buildFacilityUpdatePatch } from '../src/services/facilityService.js'

function check(input: Parameters<typeof validateJapaneseInsurance>[0]) {
    const result: Result<unknown> = { data: undefined, hasErrors: false, errors: [] }
    validateJapaneseInsurance(input, result)
    return result.errors?.map(error => [error.field, error.errorCode])
}

describe('validateJapaneseInsurance', () => {
    it('allows unknown', () => {
        expect(check({})).toEqual([])
        expect(check({ japaneseInsurance: null, japaneseInsuranceSource: null })).toEqual([])
    })

    it('allows either answer without a source', () => {
        expect(check({ japaneseInsurance: JapaneseInsurance.NotAccepted })).toEqual([])
        expect(check({ japaneseInsurance: JapaneseInsurance.Accepted, japaneseInsuranceSource: null })).toEqual([])
    })

    it('takes a link or a note as the source', () => {
        expect(check({
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            japaneseInsuranceSource: 'https://clinic.example/insurance'
        })).toEqual([])
        expect(check({
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            japaneseInsuranceSource: 'Called the clinic on 2 Nov 2026'
        })).toEqual([])
        expect(check({
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            japaneseInsuranceSource: 'x'.repeat(501)
        })).toEqual([['japaneseInsuranceSource', ErrorCode.INVALID_LENGTH_TOO_LONG]])
    })

    it('rejects a source without an answer', () => {
        expect(check({ japaneseInsuranceSource: 'https://example.com' })).toEqual([
            ['japaneseInsurance', ErrorCode.REQUIRED]
        ])
        expect(check({ japaneseInsurance: null, japaneseInsuranceSource: 'https://example.com' })).toEqual([
            ['japaneseInsurance', ErrorCode.REQUIRED]
        ])
    })
})

describe('japaneseInsuranceFields', () => {
    it('returns null for unknown and for a value it does not know', () => {
        expect(japaneseInsuranceFields({})).toEqual({ japaneseInsurance: null, japaneseInsuranceSource: null })
        expect(japaneseInsuranceFields({ japanese_insurance: 'UNINSURED', japanese_insurance_source: 'https://x.test' }))
            .toEqual({ japaneseInsurance: null, japaneseInsuranceSource: null })
    })

    it('returns the answer with its source', () => {
        expect(japaneseInsuranceFields({ japanese_insurance: 'ACCEPTED', japanese_insurance_source: 'https://x.test' }))
            .toEqual({ japaneseInsurance: JapaneseInsurance.Accepted, japaneseInsuranceSource: 'https://x.test' })
    })
})

describe('canReadModeratorNotes', () => {
    const user = (roles: Role[], scope = ''): User => ({ sub: 'user', name: '', email: '', roles, scope })

    it('lets moderators and admins read the source note', () => {
        expect(canReadModeratorNotes(user([Role.Moderator]))).toBe(true)
        expect(canReadModeratorNotes(user([Role.Admin]))).toBe(true)
    })

    it('hides it from the public, signed-in users, and clinic members', () => {
        expect(canReadModeratorNotes(null)).toBe(false)
        expect(canReadModeratorNotes(user([], 'read:facilities'))).toBe(false)
        expect(canReadModeratorNotes(user([Role.User]))).toBe(false)
        expect(canReadModeratorNotes(user([Role.FacilityOwner, Role.FacilityStaff]))).toBe(false)
    })
})

describe('buildFacilityUpdatePatch Japanese insurance', () => {
    it('stores the source on a self-pay-only clinic', () => {
        const patch = buildFacilityUpdatePatch({
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            japaneseInsuranceSource: ' https://clinic.example/insurance '
        })

        expect(patch.japanese_insurance).toBe(JapaneseInsurance.NotAccepted)
        expect(patch.japanese_insurance_source).toBe('https://clinic.example/insurance')
    })

    it('drops a source sent with any other answer, so no stale note is stored', () => {
        const accepted = buildFacilityUpdatePatch({
            japaneseInsurance: JapaneseInsurance.Accepted,
            japaneseInsuranceSource: 'https://clinic.test'
        })
        const unknown = buildFacilityUpdatePatch({ japaneseInsurance: null, japaneseInsuranceSource: null })

        expect(accepted.japanese_insurance).toBe(JapaneseInsurance.Accepted)
        expect(accepted.japanese_insurance_source).toBeNull()
        expect(unknown.japanese_insurance).toBeNull()
        expect(unknown.japanese_insurance_source).toBeNull()
    })
})
