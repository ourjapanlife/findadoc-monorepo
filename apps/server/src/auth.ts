import { FastifyInstance, FastifyRequest } from 'fastify'
import { GraphQLError, type GraphQLResolveInfo } from 'graphql'
import fastifyJwt from '@fastify/jwt'
import buildGetJwks from 'get-jwks'

import { logger } from './logger.js'
import { clientIpFrom } from '@findadoc/utils'
import { envVariables } from '../utils/environmentVariables.js'
// import { envVariables } from '../utils/environmentVariables.js'

// These are the different roles that a user can have in the system. 
// A role comes with a set of permissions or scopes to save having to define them every time. 
export enum Role {
    Admin = 'Admin',
    Moderator = 'Moderator',
    Dev = 'Dev',
    User = 'User'
}

// These are the different scopes or permissions that are available in the system.
// For example, a user with the `read:facilities` scope can read facilities data.
export enum Scope {
    'read:healthcareprofessionals' = 'read:healthcareprofessionals',
    'write:healthcareprofessionals' = 'write:healthcareprofessionals',
    'delete:healthcareprofessionals' = 'delete:healthcareprofessionals',
    'read:facilities' = 'read:facilities',
    'write:facilities' = 'write:facilities',
    'delete:facilities' = 'delete:facilities',
    'read:submissions' = 'read:submissions',
    'write:submissions' = 'write:submissions',
    'delete:submissions' = 'delete:submissions',
    'read:logs' = 'read:logs',
    'write:logs' = 'write:logs',
    'read:profile' = 'read:profile',
    'write:posts' = 'write:posts',
    'read:users' = 'read:users',
    'write:users' = 'write:users',
    'delete:users' = 'delete:users',
    'create:submissions' = 'create:submissions',
    'create:bookings' = 'create:bookings',
    'read:reservations' = 'read:reservations',
    'write:reservations' = 'write:reservations'
}

// These are the different permissions or "scopes" that are associated with each role.
// For example, an admin might have permissions to read, write, and delete healthcare professionals,
// while a user might only have permission to read their own profile and posts.
// A user can have separate scopes from their roles, so we need to check both.
const roleScopes: Record<Role, Scope[]> = {
    [Role.Admin]: [
        Scope['read:healthcareprofessionals'], Scope['write:healthcareprofessionals'], Scope['delete:healthcareprofessionals'],
        Scope['read:facilities'], Scope['write:facilities'], Scope['delete:facilities'],
        Scope['read:submissions'], Scope['write:submissions'], Scope['delete:submissions'],
        Scope['read:users'], Scope['write:users'], Scope['delete:users'],
        Scope['read:profile'], 
        Scope['write:posts'],
        Scope['read:logs'], Scope['write:logs'],
        Scope['read:reservations'], Scope['write:reservations'],
        Scope['create:bookings']
    ],
    [Role.Moderator]: [
        Scope['read:healthcareprofessionals'], Scope['write:healthcareprofessionals'], Scope['delete:healthcareprofessionals'],
        Scope['read:facilities'], Scope['write:facilities'], Scope['delete:facilities'],
        Scope['read:submissions'], Scope['write:submissions'], Scope['delete:submissions'],
        Scope['read:profile'], 
        Scope['write:posts'],
        Scope['read:reservations'], Scope['write:reservations'],
        Scope['create:bookings']
    ],
    [Role.Dev]: [
        Scope['read:healthcareprofessionals'], Scope['write:healthcareprofessionals'], Scope['delete:healthcareprofessionals'],
        Scope['read:facilities'], Scope['write:facilities'], Scope['delete:facilities'],
        Scope['read:submissions'], Scope['write:submissions'], Scope['delete:submissions'],
        Scope['read:users'], Scope['write:users'], Scope['delete:users'],
        Scope['read:profile'], 
        Scope['write:posts'],
        Scope['read:logs'], Scope['write:logs'],
        Scope['read:reservations'], Scope['write:reservations'],
        Scope['create:bookings']
    ],
    [Role.User]: [
        Scope['read:healthcareprofessionals'], 
        Scope['read:facilities'], 
        Scope['create:submissions'],
        Scope['create:bookings'],
        Scope['read:profile'],
        Scope['read:reservations'], Scope['write:reservations']
    ]
}

export interface User {
    sub: string
    name: string
    email: string
    roles: Role[]
    scope: string
    [key: string]: unknown // Allow additional properties
}

/**
 * Effective API scopes for this user: JWT `scope` claim plus scopes implied by roles,
 * with production non-admin/moderator stripping applied (same rules as {@link authorize}).
 */
export function getEffectiveScopes(user: User | null | undefined): Scope[] {
    if (!user) {
        return []
    }

    const currentUserScopes = (user.scope?.split(/\s+/).filter(Boolean) ?? []) as Scope[]
    const currentUserRoles = (user.roles as Role[]) || []

    const currentUserScopesFromRoles = currentUserRoles.flatMap(role => roleScopes[role] ?? [])
    let merged = [...currentUserScopes, ...currentUserScopesFromRoles]

    if (envVariables.isProduction() &&
        !currentUserRoles.includes(Role.Admin) &&
        !currentUserRoles.includes(Role.Moderator)) {
        merged = merged.filter(scope =>
            scope.startsWith('read:')
            || scope === Scope['create:submissions']
            || scope === Scope['create:bookings'])
    }

    return [...new Set(merged)]
}

export interface UserContext {
    user: User
    clientIp?: string
}

/**
 * Checks if the user is authorized for the given scope.
 * @param request - The Fastify request object containing the decoded JWT.
 * @param requiredScope - The scope to check for authorization. Ex. `read:facilities` or `write:healthcareprofessionals`.
 * @returns {boolean} - True if authorized, false otherwise.
 */
export function authorize(user: User, requiredScopes: Scope[]): boolean {
    try {
        // Check if we're in a testing environment such as CI/CD or local testing
        // In these cases, we want to skip auth checks to allow for easier testing.
        if (envVariables.isTestingEnvironment()) {
            return true
        }

        if (!user) {
            logger.warn('Auth: User is not defined')
            return false
        }

        const allUserScopes = getEffectiveScopes(user)
        const currentUserRoles = (user.roles as Role[]) || []

        const hasRequiredScopes = requiredScopes.every((scope: Scope) => allUserScopes.includes(scope))

        if (!hasRequiredScopes) {
            logger.warn(`Auth: ❌ User ${user.sub} is NOT authorized for the required scopes: ${requiredScopes.join(', ')}`)
            logger.warn(`Auth: User's current roles ${currentUserRoles.join(', ')} and scopes: ${allUserScopes.join(', ')}.`)
        } else {
            logger.info(`Auth: ✅ User ${user.sub} is authorized for the required scopes: ${requiredScopes.join(', ')}`)
        }

        return hasRequiredScopes
    } catch (err) {
        logger.error('Error parsing user object. Have we updated roles in Auth0 that don\'t match our required scopes above?:', err)
        return false
    }
}

type Resolver<TParent, TArgs, TContext, TResult> =
    (parent: TParent, args: TArgs, context: TContext, info: GraphQLResolveInfo) => TResult

function guardResolver<TParent, TArgs, TContext extends UserContext, TResult>(
    isAllowed: (user: User) => boolean,
    resolver: Resolver<TParent, TArgs, TContext, TResult>
): Resolver<TParent, TArgs, TContext, TResult> {
    return (parent, args, context, info) => {
        if (!isAllowed(context.user)) {
            throw new GraphQLError('User is not authorized', {
                extensions: { code: 'UNAUTHORIZED', http: { status: 403 } }
            })
        }

        return resolver(parent, args, context, info)
    }
}

/**
 * Wraps a resolver so it runs only for a user who has every listed scope.
 * Anyone else gets UNAUTHORIZED with HTTP 403. Sentry skips that code (see server.ts).
 * @param requiredScopes - The scope, or scopes, the resolver needs. Ex. `Scope['read:facilities']`.
 * @param resolver - The resolver to run once the user is authorized.
 */
export function withScope<TParent, TArgs, TContext extends UserContext, TResult>(
    requiredScopes: Scope | Scope[],
    resolver: Resolver<TParent, TArgs, TContext, TResult>
): Resolver<TParent, TArgs, TContext, TResult> {
    const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes]

    return guardResolver(user => authorize(user, scopes), resolver)
}

/**
 * Like withScope, but one of the listed scopes is enough.
 * @param acceptedScopes - Any one of these lets the resolver run.
 * @param resolver - The resolver to run once the user is authorized.
 */
export function withAnyScope<TParent, TArgs, TContext extends UserContext, TResult>(
    acceptedScopes: Scope[],
    resolver: Resolver<TParent, TArgs, TContext, TResult>
): Resolver<TParent, TArgs, TContext, TResult> {
    return guardResolver(user => acceptedScopes.some(scope => authorize(user, [scope])), resolver)
}

// This function builds the user context from the FastifyRequest object so it can be used in the graphQL resolvers.
export async function buildUserContext(req: FastifyRequest): Promise<UserContext> {
    const userFromRequest = req?.user as User

    return {
        user: {
            sub: userFromRequest?.sub,
            name: userFromRequest?.name,
            email: userFromRequest?.email,
            scope: userFromRequest?.scope || '',
            // These are custom roles defined in the Auth0 dashboard
            // They are JWT recommended prefixes with https://findadoc.jp/roles to avoid conflicts with standard JWT claims
            roles: userFromRequest['https://findadoc.jp/roles'] as Role[] || userFromRequest?.roles as Role[] || []
        } satisfies User,
        clientIp: clientIpFrom(req, envVariables.edgeSharedSecret())
    } satisfies UserContext
}

// This function intializes the auth server integration. 
// It sets up the JWT authentication and verifies the token on every request.
export async function initializeAuth(fastify: FastifyInstance) {
    logger.debug('🔓 Initializing Auth system...')

    if (envVariables.isTestingEnvironment()) {
        logger.info('Auth: Testing environment detected! Skipping auth checks.') 
    }

    const getJwks = buildGetJwks()

    await fastify.register(fastifyJwt, {
        decode: { complete: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        secret: async (request: any, token: any) => {
            const { kid, alg } = token.header

            return getJwks.getPublicKey({kid, 
                domain: 'https://findadoc.jp.auth0.com', 
                alg})
        },
        // Correcting the 'algorithm' property
        sign: {
            algorithm: 'RS256'
        }
    })

    //We want the user to be authenticated for every request. This hook will verify the JWT token on every request
    // This also allows us to retrieve the user object from the JWT token
    fastify.addHook('preHandler', async (request: FastifyRequest) => {
        // Check if Authorization header exists
        const authHeader = request.headers.authorization
        const tokenExists = !!authHeader
        
        if (tokenExists) {
            try {
                // If token exists, verify it
                await request.jwtVerify()
                // Token is valid, request.user is now available
                    
                return
            } catch (err) {
                // Token is invalid
                logger.error('Invalid token:', err) 
                return
            }
        }
            
        // If no token, continue without authentication (as anonymous user)
        request.user = {
            sub: 'Anonymous User',
            name: 'Anonymous',
            email: '',
            roles: [Role.User],
            scope: ''
        } satisfies User
    })

    logger.debug('🔐 Initialized Auth system.')
}
