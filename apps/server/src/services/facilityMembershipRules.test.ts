import { describe, expect, it } from 'vitest'
import {
    BASIC_SEAT_LIMIT,
    callerMayAssign,
    callerMayAttachLogin,
    callerMayRevoke,
    callerMayRewriteRole,
    isLoginSubject,
    roleAllowed,
    seatIsAvailable
} from './facilityMembershipRules.js'

describe('hospital seats', () => {
    it('keeps the basic plan at three active people', () => {
        expect(BASIC_SEAT_LIMIT).toBe(3)
        expect(seatIsAvailable(2, false, 3)).toBe(true)
        expect(seatIsAvailable(3, false, 3)).toBe(false)
        expect(seatIsAvailable(3, true, 3)).toBe(true)
    })

    it('lets Find a Doc staff assign an owner, and an owner assign staff', () => {
        expect(roleAllowed(true, 'owner')).toBe(true)
        expect(roleAllowed(false, 'owner')).toBe(false)
        expect(roleAllowed(false, 'staff')).toBe(true)
        expect(callerMayAssign(false, true)).toBe(true)
        expect(callerMayAssign(false, false)).toBe(false)
        expect(callerMayRevoke(false, true, 'staff')).toBe(true)
        expect(callerMayRevoke(false, true, 'owner')).toBe(false)
        expect(callerMayRevoke(true, false, 'owner')).toBe(true)
        expect(callerMayRewriteRole(false, 'owner')).toBe(false)
        expect(callerMayRewriteRole(true, 'owner')).toBe(true)
        expect(callerMayRewriteRole(false, 'staff')).toBe(true)
        expect(callerMayAttachLogin(false)).toBe(false)
        expect(callerMayAttachLogin(true)).toBe(true)
    })

    it('does not treat an anonymous request as a login', () => {
        expect(isLoginSubject('Anonymous User')).toBe(false)
        expect(isLoginSubject('auth0|abc')).toBe(true)
        expect(isLoginSubject('')).toBe(false)
    })
})
