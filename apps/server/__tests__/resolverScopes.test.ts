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

// Clinic owners and staff are plain users. These need a signed-in session, then the
// booking services check the facility membership (src/booking/access.ts).
const membershipFields = new Set([
    'myBookingClinics',
    'bookingClinic',
    'clinicMembers',
    'bookingSettings',
    'clinicAppointments',
    'bookingSubmissions',
    'bookingSubmissionsTotalCount',
    'bookingSubmission',
    'clinicAvailabilityWindows',
    'bookingUploadDownloadUrl',
    'createClinicAvailabilityWindow',
    'deleteClinicAvailabilityWindow',
    'updateBookingAppointmentStatus',
    'inviteClinicMember',
    'removeClinicMember',
    'updateBookingSettings'
])

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
        expect(membershipRootFields.map(([name]) => fieldName(name)).sort()).toEqual([...membershipFields].sort())
    })

    it.each(membershipRootFields)('%s rejects a signed-out visitor', async (_name, resolver) => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)

        await expect(Promise.resolve().then(() => resolver({}, {}, anonymousContext, info)))
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
