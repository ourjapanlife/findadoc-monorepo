import { GraphQLError, type GraphQLResolveInfo } from 'graphql'
import { Role, Scope, authorize, type User, type UserContext } from '../auth.js'
import { MEMBERSHIP_ROLE, bookingAccessFor, type BookingAccess } from './access.js'

/**
 * FacilityOwner and FacilityStaff come from claimed clinic_memberships rows, read on every
 * request. They are never taken from the Auth0 token. A claimed invite counts on the next
 * request, and a removed member loses the role on theirs.
 *
 * A role only says the user may do this kind of thing at some clinic. The booking services
 * still check which facility through the BookingAccess this loads (access.ts).
 */

const accessByContext = new WeakMap<UserContext, Promise<BookingAccess>>()

/** One membership read per request. The resolver and the guard share it. */
export function bookingAccessForContext(context: UserContext): Promise<BookingAccess> {
    const cached = accessByContext.get(context)
    if (cached !== undefined) {
        return cached
    }
    const access = bookingAccessFor(context.user)
    accessByContext.set(context, access)
    return access
}

/** FacilityOwner when the user owns any clinic, FacilityStaff when they are staff at any clinic. */
export function facilityRolesFrom(access: BookingAccess): Role[] {
    const memberships = [...access.memberships.values()]
    const roles: Role[] = []
    if (memberships.includes(MEMBERSHIP_ROLE.OWNER)) {
        roles.push(Role.FacilityOwner)
    }
    if (memberships.includes(MEMBERSHIP_ROLE.STAFF)) {
        roles.push(Role.FacilityStaff)
    }
    return roles
}

/** The user with their derived facility roles added to the token roles. */
export async function userWithFacilityRoles(context: UserContext): Promise<User> {
    const user = context.user
    const facilityRoles = facilityRolesFrom(await bookingAccessForContext(context))
    return { ...user, roles: [...new Set([...(user.roles ?? []), ...facilityRoles])] }
}

type Resolver<TParent, TArgs, TContext, TResult> =
    (parent: TParent, args: TArgs, context: TContext, info: GraphQLResolveInfo) => TResult

/**
 * Like withAnyScope, but counts the facility roles derived from clinic_memberships.
 * List the every-clinic scope an admin holds next to the own-clinic scope.
 */
export function withClinicScope<TParent, TArgs, TContext extends UserContext, TResult>(
    acceptedScopes: Scope[],
    resolver: Resolver<TParent, TArgs, TContext, Promise<TResult>>
): Resolver<TParent, TArgs, TContext, Promise<TResult>> {
    return async (parent, args, context, info) => {
        const user = await userWithFacilityRoles(context)
        if (!acceptedScopes.some(scope => authorize(user, [scope]))) {
            throw new GraphQLError('User is not authorized', {
                extensions: { code: 'UNAUTHORIZED', http: { status: 403 } }
            })
        }

        return resolver(parent, args, context, info)
    }
}
