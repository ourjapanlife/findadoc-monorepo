import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'
import resolvers from '../src/resolvers.js'
import { ANONYMOUS_USER_SUB, Role, Scope, withAnyScope, withScope, type UserContext } from '../src/auth.js'
import { envVariables } from '../utils/environmentVariables.js'

function contextWithScopes(...scopes: Scope[]): UserContext {
    return {
        user: { sub: 'test|scopes', name: 'Scope Test', email: 'scope@example.com', roles: [], scope: scopes.join(' ') }
    }
}

const info = {} as GraphQLResolveInfo
const unauthorized = { extensions: { code: 'UNAUTHORIZED', http: { status: 403 } } }

// currentUserAccess reports the caller's own roles and scopes, so it has no scope of its own.
const fieldsWithoutScope = new Set(['currentUserAccess'])

// myBookingClinics needs only a signed-in session. It returns an empty list to someone with no clinic.
const signedInFields = new Set(['myBookingClinics'])

// These count FacilityOwner and FacilityStaff, which the API derives from clinic_memberships
// (src/booking/facilityRoles.ts). The booking services then check which facility.
const clinicFields = new Set([
    'bookingClinic',
    'clinicMembers',
    'bookingSettings',
    'clinicInterpreters',
    'clinicAppointments',
    'bookingSubmissions',
    'bookingSubmissionsTotalCount',
    'bookingSubmission',
    'clinicAvailabilityWindows',
    'bookingUploadDownloadUrl',
    'createClinicAvailabilityWindow',
    'deleteClinicAvailabilityWindow',
    'clinicPractitioners',
    'clinicWeeklyHours',
    'clinicAvailabilityClosures',
    'setClinicWeeklyHours',
    'createClinicAvailabilityClosure',
    'deleteClinicAvailabilityClosure',
    'updateBookingAppointmentStatus',
    'inviteClinicMember',
    'removeClinicMember',
    'updateBookingSettings',
    'setBookingInterpretation',
    'saveClinicInterpreter',
    'deleteClinicInterpreter'
])
const membershipFields = new Set([...signedInFields, ...clinicFields])

type AnyResolver = (parent: unknown, args: unknown, context: UserContext, info: GraphQLResolveInfo) => unknown

const allRootFields = [
    ...Object.entries(resolvers.Query).map(([name, resolver]) => [`Query.${name}`, resolver]),
    ...Object.entries(resolvers.Mutation).map(([name, resolver]) => [`Mutation.${name}`, resolver])
] as [string, AnyResolver][]
const fieldName = (name: string) => name.split('.')[1]!

const rootFields = allRootFields.filter(([name]) =>
    !fieldsWithoutScope.has(fieldName(name)) && !membershipFields.has(fieldName(name)))
const membershipRootFields = allRootFields.filter(([name]) => membershipFields.has(fieldName(name)))

const anonymousContext: UserContext = {
    user: { sub: ANONYMOUS_USER_SUB, name: 'Anonymous', email: '', roles: [Role.User], scope: '' }
}

describe('root resolver scopes', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('covers every root field', () => {
        expect(rootFields.length).toBeGreaterThan(30)
    })

    it.each(rootFields)('%s rejects a user without its scope', async (_name, resolver) => {
        // The test server turns scope checks off. This test turns them back on.
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)

        await expect(Promise.resolve().then(() => resolver({}, {}, contextWithScopes(), info)))
            .rejects.toMatchObject(unauthorized)
    })

    it('lists every membership field it exempts', () => {
        expect([...signedInFields].some(name => clinicFields.has(name))).toBe(false)
        expect(membershipRootFields.map(([name]) => fieldName(name)).sort()).toEqual([...membershipFields].sort())
    })

    it.each(membershipRootFields)('%s rejects a signed-out visitor', async (_name, resolver) => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)

        await expect(Promise.resolve().then(() => resolver({}, {}, anonymousContext, info)))
            .rejects.toMatchObject(unauthorized)
    })

    const clinicRootFields = membershipRootFields.filter(([name]) => clinicFields.has(fieldName(name)))

    it.each(clinicRootFields)('%s rejects a signed-in user with no clinic, even when the token names own-clinic scopes', async (_name, resolver) => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const context = contextWithScopes(
            Scope['read:own_clinic_bookings'], Scope['write:own_clinic_bookings'], Scope['write:own_clinic_availability'],
            Scope['write:own_clinic_settings'], Scope['write:own_clinic_memberships']
        )

        await expect(Promise.resolve().then(() => resolver({}, {}, context, info)))
            .rejects.toMatchObject(unauthorized)
    })
})

describe('withScope', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('runs the resolver only when the user has every listed scope', () => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const resolver = vi.fn(() => 'ran')
        const guarded = withScope([Scope['read:facilities'], Scope['write:facilities']], resolver)

        expect(guarded({}, {}, contextWithScopes(Scope['read:facilities'], Scope['write:facilities']), info)).toBe('ran')
        expect(() => guarded({}, {}, contextWithScopes(Scope['read:facilities']), info)).toThrow('User is not authorized')
        expect(resolver).toHaveBeenCalledTimes(1)
    })
})

describe('withAnyScope', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('runs the resolver when the user has one of the listed scopes', () => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const resolver = vi.fn(() => 'ran')
        const guarded = withAnyScope([Scope['write:submissions'], Scope['create:submissions']], resolver)

        expect(guarded({}, {}, contextWithScopes(Scope['create:submissions']), info)).toBe('ran')
        expect(() => guarded({}, {}, contextWithScopes(Scope['read:submissions']), info)).toThrow('User is not authorized')
        expect(resolver).toHaveBeenCalledTimes(1)
    })
})
