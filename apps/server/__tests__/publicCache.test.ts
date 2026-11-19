import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginCacheControlDisabled } from '@apollo/server/plugin/disabled'
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify'
import { buildASTSchema } from 'graphql'
import resolvers from '../src/resolvers.js'
import loadSchema from '../src/schema.js'
import { ANONYMOUS_USER_SUB, Role, type UserContext } from '../src/auth.js'
import { envVariables } from '../utils/environmentVariables.js'
import {
    PRIVATE_CACHE_CONTROL,
    PUBLIC_CACHE_CONTROL,
    PUBLIC_CACHEABLE_QUERY_FIELDS,
    csrfPreventionPlugin,
    publicCachePlugin
} from '../src/publicCache.js'

/*
 * A small schema with the same root names as the real one, so the plugins can be tested over
 * HTTP without a database. The real allowlist is checked against the real schema below.
 */
const typeDefs = `#graphql
    type Facility { id: ID!, japaneseInsuranceSource: String }
    type Submission { id: ID! }
    type Query {
        facilities: [Facility!]!
        facilitiesTotalCount(fail: Boolean): Int!
        submissions: [Submission!]!
        specialties: [String!]!
        specialtyCategories: [String!]!
        languages(publishedOnly: Boolean): [String!]!
    }
    type Mutation { createSubmission: Submission! }
`

const testResolvers = {
    Query: {
        facilities: () => [{ id: 'facility-1' }],
        facilitiesTotalCount: (_parent: unknown, args: { fail?: boolean }) => {
            if (args.fail) {
                throw new Error('boom')
            }
            return 1
        },
        submissions: () => [{ id: 'submission-1' }],
        specialties: () => ['DENTISTRY'],
        specialtyCategories: () => ['DENTAL'],
        languages: () => ['ja_JP']
    },
    Facility: {
        japaneseInsuranceSource: (_parent: unknown, _args: unknown, context: UserContext) =>
            context.user.sub === ANONYMOUS_USER_SUB ? null : 'internal note'
    },
    Mutation: { createSubmission: () => ({ id: 'submission-2' }) }
}

const anonymousUser: UserContext['user'] = { sub: ANONYMOUS_USER_SUB, name: '', email: '', roles: [Role.User], scope: '' }
const editorUser: UserContext['user'] = {
    sub: 'auth0|editor',
    name: 'Editor',
    email: 'editor@example.com',
    roles: [Role.Moderator],
    scope: 'write:facilities'
}

let app: FastifyInstance

beforeAll(async () => {
    app = Fastify()

    const apollo = new ApolloServer<UserContext>({
        typeDefs,
        resolvers: testResolvers,
        csrfPrevention: false,
        plugins: [
            fastifyApolloDrainPlugin(app),
            ApolloServerPluginCacheControlDisabled(),
            csrfPreventionPlugin(),
            publicCachePlugin()
        ]
    })
    await apollo.start()

    app.route({
        url: '/',
        method: ['GET', 'POST', 'OPTIONS'],
        handler: fastifyApolloHandler(apollo, {
            context: async request => ({
                user: request.headers.authorization ? editorUser : anonymousUser
            })
        })
    })
    await app.ready()
})

afterAll(async () => {
    await app.close()
})

function getQuery(query: string, headers: Record<string, string> = {}) {
    return app.inject({ method: 'GET', url: `/?${new URLSearchParams({ query })}`, headers })
}

function postJson(query: string, headers: Record<string, string> = {}) {
    return app.inject({
        method: 'POST',
        url: '/',
        headers: { 'content-type': 'application/json', ...headers },
        payload: JSON.stringify({ query })
    })
}

describe('Cache-Control on GraphQL responses (#242)', () => {
    it('marks an anonymous public read public', async () => {
        const response = await getQuery('{ facilities { id } facilitiesTotalCount }')

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe(PUBLIC_CACHE_CONTROL)
        expect(response.headers.vary).toContain('Authorization')
    })

    it('marks a read of only the filter vocabulary public (#24)', async () => {
        const response = await getQuery('{ specialties specialtyCategories languages(publishedOnly: false) }')

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe(PUBLIC_CACHE_CONTROL)
    })

    it('never marks a request with a bearer token public, even for a public field', async () => {
        const response = await getQuery('{ facilities { id japaneseInsuranceSource } }', {
            authorization: 'Bearer editor-token'
        })

        expect(response.json()).toEqual({ data: { facilities: [{ id: 'facility-1', japaneseInsuranceSource: 'internal note' }] } })
        expect(response.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL)
    })

    it('keeps a response private when one root field is private', async () => {
        const response = await postJson('{ facilities { id } submissions { id } }')

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL)
    })

    it('never caches an answer with errors', async () => {
        const response = await getQuery('{ facilitiesTotalCount(fail: true) }')

        expect(response.json().errors).toBeDefined()
        expect(response.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL)
    })

    it('never caches a mutation', async () => {
        const response = await postJson('mutation { createSubmission { id } }')

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL)
    })

    it('keeps a root fragment private instead of guessing what it selects', async () => {
        const response = await postJson('{ ...Q } fragment Q on Query { facilities { id } }')

        expect(response.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL)
    })
})

describe('CSRF prevention (#242)', () => {
    it('serves a public read as a plain GET, with no preflight header', async () => {
        const response = await getQuery('{ facilitiesTotalCount }')

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ data: { facilitiesTotalCount: 1 } })
    })

    it('refuses a private read sent as a plain GET', async () => {
        const response = await getQuery('{ submissions { id } }')

        expect(response.statusCode).toBe(400)
        expect(response.json().data).toBeUndefined()
    })

    it('serves a private read when the GET carries the preflight header', async () => {
        const response = await getQuery('{ submissions { id } }', { 'x-apollo-operation-name': 'Submissions' })

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL)
    })

    it('refuses a mutation posted as a form, the request a cross-site page can forge', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/',
            headers: { 'content-type': 'text/plain' },
            payload: JSON.stringify({ query: 'mutation { createSubmission { id } }' })
        })

        expect(response.statusCode).toBe(400)
    })

    it('refuses a mutation sent as a GET', async () => {
        const response = await getQuery('mutation { createSubmission { id } }', { 'apollo-require-preflight': 'true' })

        expect(response.statusCode).toBe(405)
    })
})

describe('the public field list', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    const listedRootFields = [...PUBLIC_CACHEABLE_QUERY_FIELDS].filter(field => !field.startsWith('__'))

    // Fields that read the caller, the IP, the viewer country, a token, or a rate limit.
    const callerDependentFields = [
        'currentUserAccess',
        'mapsPlacePreview',
        'suggestFacilityPlaces',
        'suggestCities',
        'bookingAvailable',
        'bookingForm',
        'availableBookingStarts',
        'bookingFormTypes',
        'patientBooking',
        'myBookingClinics',
        'bookingClinics',
        'submission',
        'submissions',
        'submissionsTotalCount',
        'user',
        'reservation'
    ]

    it('names only fields the schema and the resolvers have', () => {
        // Loaded here, after the test setup has started the logger.
        const queryType = buildASTSchema(loadSchema()).getQueryType()
        listedRootFields.forEach(field => {
            expect(queryType?.getFields()[field], field).toBeDefined()
            expect((resolvers.Query as Record<string, unknown>)[field], field).toBeDefined()
        })
    })

    it('leaves out every field that depends on the caller', () => {
        callerDependentFields.forEach(field => expect(PUBLIC_CACHEABLE_QUERY_FIELDS.has(field), field).toBe(false))
    })

    it('leaves out every booking, clinic, and moderation field', () => {
        listedRootFields.forEach(field =>
            expect(field, field).not.toMatch(/booking|clinic(?!Site)|submission|user|reservation|appointment|upload/i))
    })

    it('lists only fields an anonymous visitor may read in production', async () => {
        vi.spyOn(envVariables, 'isTestingEnvironment').mockReturnValue(false)
        vi.spyOn(envVariables, 'isProduction').mockReturnValue(true)
        const anonymous: UserContext = {
            user: { sub: ANONYMOUS_USER_SUB, name: 'Anonymous', email: '', roles: [Role.User], scope: '' }
        }

        for (const field of listedRootFields) {
            const resolver = (resolvers.Query as Record<string, (...args: unknown[]) => unknown>)[field]!
            // The service may fail without a database. Only a refusal for scope matters here.
            const outcome = await Promise.resolve()
                .then(() => resolver({}, { filters: {}, id: 'x', slug: 'x', prefecture: 'tokyo', citySlug: 'x' }, anonymous, {}))
                .catch((error: { extensions?: { code?: string } }) => error)
            expect((outcome as { extensions?: { code?: string } } | null)?.extensions?.code, field).not.toBe('UNAUTHORIZED')
        }
    })
})
