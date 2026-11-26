import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'
import { ArchiveFilter } from '@findadoc/graphql'
import resolvers, { assertArchiveFilterAllowed } from '../src/resolvers.js'
import {
    ANONYMOUS_USER_SUB,
    Role,
    Scope,
    canReadArchivedFacilities,
    canReadArchivedProfessionals,
    withAnyScope,
    withScope,
    type UserContext
} from '../src/auth.js'
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
    'bookingPaymentSettings',
    'clinicInterpreters',
    'clinicAppointments',
    'bookingSubmissions',
    'bookingSubmissionsTotalCount',
    'bookingSubmission',
    'bookingSubmissionsExport',
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
    'updateBookingPaymentSettings',
    'createPaymentQrUploadUrl',
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

    // An admin sets up clinic accounts: the clinic, its settings summary, its members, and
    // interpretation. Every booking, appointment, upload, calendar, and owner setting needs a
    // claimed membership, so an admin with none is refused (#192).
    const adminSetupFields = new Set([
        'bookingClinic',
        'bookingSettings',
        'clinicMembers',
        'inviteClinicMember',
        'removeClinicMember',
        'setBookingInterpretation'
    ])
    const adminRefusedFields = clinicRootFields.filter(([name]) => !adminSetupFields.has(fieldName(name)))

    it('refuses an admin on every booking read', () => {
        const refused = new Set(adminRefusedFields.map(([name]) => fieldName(name)))
        for (const read of [
            'bookingSubmissions', 'bookingSubmissionsTotalCount', 'bookingSubmission', 'bookingSubmissionsExport',
            'bookingUploadDownloadUrl', 'clinicAppointments', 'bookingPaymentSettings', 'clinicInterpreters',
            'clinicAvailabilityWindows', 'clinicWeeklyHours', 'clinicAvailabilityClosures', 'clinicPractitioners'
        ]) {
            expect(refused.has(read)).toBe(true)
        }
    })

    it.each(adminRefusedFields)('%s rejects an admin who is not a member of the clinic', async (_name, resolver) => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const context: UserContext = {
            user: { sub: 'test|admin-no-clinic', name: 'Admin', email: 'admin@example.com', roles: [Role.Admin], scope: '' }
        }

        await expect(Promise.resolve().then(() => resolver({}, {}, context, info)))
            .rejects.toMatchObject(unauthorized)
    })

    it.each(['bookingClinics'])('%s is open to an admin, for the clinic-account picker', async name => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const context: UserContext = {
            user: { sub: 'test|admin-no-clinic', name: 'Admin', email: 'admin@example.com', roles: [Role.Admin], scope: '' }
        }
        const resolver = resolvers.Query[name as 'bookingClinics'] as AnyResolver

        await expect(Promise.resolve().then(() => resolver({}, {}, context, info))).resolves.toBeInstanceOf(Array)
    })
})

describe('submitFacilityCorrection scope', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    const call = (context: UserContext) => Promise.resolve().then(() => resolvers.Mutation.submitFacilityCorrection(
        {},
        { input: { facilityId: 'not-a-uuid', reasons: [] } },
        { ...context, clientIp: '198.51.100.7' },
        info
    ))

    it('lets a signed-out visitor through to validation', async () => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)

        await expect(call(anonymousContext)).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it('refuses a user without create:submissions or write:submissions', async () => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)

        await expect(call(contextWithScopes(Scope['read:submissions']))).rejects.toMatchObject(unauthorized)
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

describe('archive scopes', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    const moderatorContext: UserContext = {
        user: { sub: 'test|moderator', name: 'Moderator', email: 'mod@example.com', roles: [Role.Moderator], scope: '' }
    }
    const mutation = (name: string) => resolvers.Mutation[name as keyof typeof resolvers.Mutation] as AnyResolver
    const query = (name: string) => resolvers.Query[name as keyof typeof resolvers.Query] as AnyResolver

    it.each([
        'archiveFacility', 'unarchiveFacility', 'archiveHealthcareProfessional', 'unarchiveHealthcareProfessional'
    ])('%s lets a moderator through to validation and refuses a signed-in user', async name => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const args = { id: 'not-a-uuid', reason: 'Closed' }

        await expect(Promise.resolve().then(() => mutation(name)({}, args, moderatorContext, info)))
            .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
        await expect(Promise.resolve().then(() => mutation(name)({}, args, anonymousContext, info)))
            .rejects.toMatchObject(unauthorized)
    })

    it('removes the hard-delete mutations', () => {
        expect(Object.keys(resolvers.Mutation)).not.toContain('deleteFacility')
        expect(Object.keys(resolvers.Mutation)).not.toContain('deleteHealthcareProfessional')
    })

    it.each([
        'facilities', 'facilitiesTotalCount', 'healthcareProfessionals', 'healthcareProfessionalsTotalCount'
    ])('%s refuses archived records to the public', async name => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        const archived = { filters: { archive: ArchiveFilter.Archived } }

        await expect(Promise.resolve().then(() => query(name)({}, archived, anonymousContext, info)))
            .rejects.toMatchObject(unauthorized)
    })
})

describe('assertArchiveFilterAllowed', () => {
    it('lets anyone list active records and only moderators list archived ones', () => {
        expect(() => assertArchiveFilterAllowed(undefined, false)).not.toThrow()
        expect(() => assertArchiveFilterAllowed(ArchiveFilter.Active, false)).not.toThrow()
        expect(() => assertArchiveFilterAllowed(ArchiveFilter.All, true)).not.toThrow()
        expect(() => assertArchiveFilterAllowed(ArchiveFilter.All, false)).toThrow('User is not authorized')
        expect(() => assertArchiveFilterAllowed(ArchiveFilter.Archived, false)).toThrow('User is not authorized')
    })

    it('matches the moderator check: moderators and admins, not users or clinic members', () => {
        const user = (roles: Role[]) => ({ sub: 'user', name: '', email: '', roles, scope: '' })

        expect(canReadArchivedFacilities(user([Role.Moderator]))).toBe(true)
        expect(canReadArchivedProfessionals(user([Role.Admin]))).toBe(true)
        expect(canReadArchivedFacilities(user([Role.User]))).toBe(false)
        expect(canReadArchivedProfessionals(user([Role.FacilityOwner, Role.FacilityStaff]))).toBe(false)
        expect(canReadArchivedFacilities(null)).toBe(false)
    })
})
