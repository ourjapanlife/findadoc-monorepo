import { describe, expect, it } from 'vitest'
import {
    APPOINTMENT_STATUS,
    canPatientCancel,
    canStaffMoveTo
} from '../src/booking/lifecycle.js'
import { availableStarts, mergeWindows } from '../src/booking/schedule.js'
import { hashPatientToken, newPatientToken } from '../src/booking/links.js'
import {
    MEMBERSHIP_ROLE,
    canManageFacility,
    canReadFacility,
    readableFacilityIds,
    verifiedEmailFromUser,
    type BookingAccess
} from '../src/booking/access.js'
import { Role } from '../src/auth.js'

const at = (iso: string) => new Date(`2026-11-05T${iso}:00.000Z`)

describe('availability windows', () => {
    it('joins painted windows that touch or overlap', () => {
        const merged = mergeWindows([
            { startsAt: at('02:00'), endsAt: at('02:30') },
            { startsAt: at('01:00'), endsAt: at('01:30') },
            { startsAt: at('01:30'), endsAt: at('02:00') },
            { startsAt: at('04:00'), endsAt: at('04:30') }
        ])
        expect(merged.map(window => [window.startsAt.toISOString(), window.endsAt.toISOString()])).toEqual([
            [at('01:00').toISOString(), at('02:30').toISOString()],
            [at('04:00').toISOString(), at('04:30').toISOString()]
        ])
    })

    it('fits a 60-minute visit across two adjacent 30-minute windows', () => {
        const starts = availableStarts({
            windows: [
                { startsAt: at('01:00'), endsAt: at('01:30') },
                { startsAt: at('01:30'), endsAt: at('02:00') }
            ],
            booked: [],
            rangeStart: at('00:00'),
            rangeEnd: at('03:00'),
            durationMs: 60 * 60 * 1000
        })
        expect(starts.map(start => start.toISOString())).toEqual([at('01:00').toISOString()])
    })
})

describe('appointment lifecycle', () => {
    it('lets staff confirm, decline, or cancel a request', () => {
        expect(canStaffMoveTo(APPOINTMENT_STATUS.REQUESTED, APPOINTMENT_STATUS.CONFIRMED)).toBe(true)
        expect(canStaffMoveTo(APPOINTMENT_STATUS.REQUESTED, APPOINTMENT_STATUS.DECLINED)).toBe(true)
        expect(canStaffMoveTo(APPOINTMENT_STATUS.REQUESTED, APPOINTMENT_STATUS.CANCELLED)).toBe(true)
        expect(canStaffMoveTo(APPOINTMENT_STATUS.REQUESTED, APPOINTMENT_STATUS.COMPLETED)).toBe(false)
    })

    it('does not reopen a closed appointment', () => {
        const closedStatuses = [APPOINTMENT_STATUS.DECLINED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED]
        for (const closed of closedStatuses) {
            expect(canStaffMoveTo(closed, APPOINTMENT_STATUS.CONFIRMED)).toBe(false)
        }
        expect(canStaffMoveTo('held', APPOINTMENT_STATUS.CONFIRMED)).toBe(false)
    })

    it('lets the patient cancel only a future request or confirmed visit', () => {
        const now = at('01:00')
        expect(canPatientCancel(APPOINTMENT_STATUS.REQUESTED, at('02:00'), now)).toBe(true)
        expect(canPatientCancel(APPOINTMENT_STATUS.CONFIRMED, at('02:00'), now)).toBe(true)
        expect(canPatientCancel(APPOINTMENT_STATUS.CONFIRMED, at('00:30'), now)).toBe(false)
        expect(canPatientCancel(APPOINTMENT_STATUS.DECLINED, at('02:00'), now)).toBe(false)
    })
})

describe('patient token', () => {
    it('stores only a sha256 of a url-safe token', () => {
        const { token, hash } = newPatientToken()
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
        expect(hashPatientToken(token)).toBe(hash)
        expect(newPatientToken().token).not.toBe(token)
    })
})

describe('clinic access', () => {
    const member = (memberships: [string, 'owner' | 'staff'][]): BookingAccess => ({
        readAll: false,
        writeAll: false,
        manageMembersAll: false,
        memberships: new Map(memberships)
    })

    it('limits staff to their own facility', () => {
        const access = member([['facility-a', MEMBERSHIP_ROLE.STAFF]])
        expect(canReadFacility(access, 'facility-a')).toBe(true)
        expect(canReadFacility(access, 'facility-b')).toBe(false)
        expect(canReadFacility(access, null)).toBe(false)
        expect(canManageFacility(access, 'facility-a')).toBe(false)
        expect(readableFacilityIds(access)).toEqual(['facility-a'])
    })

    it('lets an owner manage their facility only', () => {
        const access = member([['facility-a', MEMBERSHIP_ROLE.OWNER]])
        expect(canManageFacility(access, 'facility-a')).toBe(true)
        expect(canManageFacility(access, 'facility-b')).toBe(false)
    })

    it('claims invites only for a verified email', () => {
        const base = { sub: 'auth0|1', name: 'A', roles: [Role.User], scope: '' }
        expect(verifiedEmailFromUser({ ...base, email: 'Doc@Clinic.jp', emailVerified: true })).toBe('doc@clinic.jp')
        expect(verifiedEmailFromUser({ ...base, email: 'doc@clinic.jp', emailVerified: false })).toBeUndefined()
        expect(verifiedEmailFromUser({ ...base, email: 'doc@clinic.jp' })).toBeUndefined()
    })
})
