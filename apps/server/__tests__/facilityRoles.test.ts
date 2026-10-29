import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'
import { ClinicMemberRole } from '@findadoc/graphql'
import { sharedFacilityIds } from './testSetup.test.js'
import { db } from '../src/kyselyClient.js'
import resolvers from '../src/resolvers.js'
import { Role, Scope, type UserContext } from '../src/auth.js'
import { MEMBERSHIP_ROLE, type BookingAccess } from '../src/booking/access.js'
import { facilityRolesFrom, withClinicScope } from '../src/booking/facilityRoles.js'
import * as clinicAccessService from '../src/services/clinicAccessService.js'
import { envVariables } from '../utils/environmentVariables.js'

const info = {} as GraphQLResolveInfo
const admin: BookingAccess = { readAll: true, writeAll: true, manageMembersAll: true, memberships: new Map() }

// A new context per call, the same as a new request.
function requestFrom(sub: string, email: string): UserContext {
    return { user: { sub, name: 'Clinic Member', email, emailVerified: true, roles: [Role.User], scope: '' } }
}

async function rolesOf(context: UserContext): Promise<string[]> {
    return (await resolvers.Query.currentUserAccess({}, {}, context)).roles
}

function accessWith(...memberships: [string, typeof MEMBERSHIP_ROLE[keyof typeof MEMBERSHIP_ROLE]][]): BookingAccess {
    return { readAll: false, writeAll: false, manageMembersAll: false, memberships: new Map(memberships) }
}

describe('facilityRolesFrom()', () => {
    it('gives no facility role without a claimed membership', () => {
        expect(facilityRolesFrom(accessWith())).toEqual([])
    })

    it('gives FacilityOwner for an owner row and FacilityStaff for a staff row', () => {
        expect(facilityRolesFrom(accessWith(['a', MEMBERSHIP_ROLE.OWNER]))).toEqual([Role.FacilityOwner])
        expect(facilityRolesFrom(accessWith(['a', MEMBERSHIP_ROLE.STAFF]))).toEqual([Role.FacilityStaff])
        expect(facilityRolesFrom(accessWith(['a', MEMBERSHIP_ROLE.OWNER], ['b', MEMBERSHIP_ROLE.STAFF])))
            .toEqual([Role.FacilityOwner, Role.FacilityStaff])
    })
})

describe('facility roles from clinic_memberships', () => {
    const facilityId = () => sharedFacilityIds[0]!

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        await db.deleteFrom('clinic_memberships').where('facility_id', '=', facilityId()).execute()
    })

    it('gives FacilityStaff on the request after the invite is claimed, and takes it away on removal', async () => {
        const invite = await clinicAccessService.inviteClinicMember(
            { facilityId: facilityId(), email: 'derived-staff@example.com', role: ClinicMemberRole.Staff },
            admin,
            'test|admin'
        )
        expect(invite.hasErrors).toBe(false)

        // The first request claims the invite for this verified email.
        expect(await rolesOf(requestFrom('auth0|derived-staff', 'derived-staff@example.com')))
            .toContain(Role.FacilityStaff)

        await clinicAccessService.removeClinicMember(invite.data.id, admin)
        expect(await rolesOf(requestFrom('auth0|derived-staff', 'derived-staff@example.com')))
            .not.toContain(Role.FacilityStaff)
    })

    it('gives FacilityOwner to a claimed owner', async () => {
        const invite = await clinicAccessService.inviteClinicMember(
            { facilityId: facilityId(), email: 'derived-owner@example.com', role: ClinicMemberRole.Owner },
            admin,
            'test|admin'
        )
        expect(invite.hasErrors).toBe(false)

        const roles = await rolesOf(requestFrom('auth0|derived-owner', 'derived-owner@example.com'))
        expect(roles).toContain(Role.FacilityOwner)
        expect(roles).not.toContain(Role.FacilityStaff)
    })

    it('ignores a facility role that the token claims', async () => {
        const context = requestFrom('auth0|token-owner', 'token-owner@example.com')
        context.user.scope = 'read:own_clinic_bookings write:own_clinic_memberships'
        const access = await resolvers.Query.currentUserAccess({}, {}, context)

        expect(access.roles).not.toContain(Role.FacilityOwner)
        expect(access.effectiveScopes).not.toContain(Scope['read:own_clinic_bookings'])
    })

    it('lets staff read and edit the calendar, but not manage members or settings', async () => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        await clinicAccessService.inviteClinicMember(
            { facilityId: facilityId(), email: 'guarded-staff@example.com', role: ClinicMemberRole.Staff },
            admin,
            'test|admin'
        )
        const resolver = vi.fn(async () => 'ran')
        const staffRequest = () => requestFrom('auth0|guarded-staff', 'guarded-staff@example.com')
        const outsiderRequest = () => requestFrom('auth0|outsider', 'outsider@example.com')

        const read = withClinicScope([Scope['read:bookings'], Scope['read:own_clinic_bookings']], resolver)
        const members = withClinicScope([Scope['write:clinic_memberships'], Scope['write:own_clinic_memberships']], resolver)
        const settings = withClinicScope([Scope['write:clinic_memberships'], Scope['write:own_clinic_settings']], resolver)

        expect(await read({}, {}, staffRequest(), info)).toBe('ran')
        await expect(members({}, {}, staffRequest(), info)).rejects.toThrow('User is not authorized')
        await expect(settings({}, {}, staffRequest(), info)).rejects.toThrow('User is not authorized')
        await expect(read({}, {}, outsiderRequest(), info)).rejects.toThrow('User is not authorized')
        expect(resolver).toHaveBeenCalledTimes(1)
    })
})
