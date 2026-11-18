import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { ApolloServer } from '@apollo/server'
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify'
import { ANONYMOUS_USER_SUB, buildUserContext, initializeAuth, type UserContext } from '../src/auth.js'

// The real auth hook and context builder in front of a one-field schema (#123).
let fastify: FastifyInstance

beforeAll(async () => {
    fastify = Fastify()
    await initializeAuth(fastify)

    const apollo = new ApolloServer<UserContext>({
        typeDefs: 'type Query { whoAmI: String }',
        resolvers: { Query: { whoAmI: (_parent: unknown, _args: unknown, context: UserContext) => context.user.sub } },
        plugins: [fastifyApolloDrainPlugin(fastify)]
    })
    await apollo.start()

    fastify.route({
        url: '/',
        method: ['GET', 'POST'],
        handler: fastifyApolloHandler(apollo, { context: async request => buildUserContext(request) })
    })
    await fastify.ready()
})

afterAll(async () => {
    await fastify.close()
})

const postQuery = (headers: Record<string, string> = {}) => fastify.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json', ...headers },
    payload: { query: '{ whoAmI }' }
})

describe('a request with a malformed bearer token', () => {
    it('gets 401 UNAUTHENTICATED instead of a server error', async () => {
        const response = await postQuery({ authorization: 'Bearer not-a-real-token' })
        const body = response.json() as { errors?: { message: string, extensions?: { code?: string } }[] }

        expect(response.statusCode).toBe(401)
        expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED')
        expect(body.errors?.[0]?.message).not.toContain('Cannot read properties')
    })

    it('still answers a request with no Authorization header as the anonymous user', async () => {
        const response = await postQuery()

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ data: { whoAmI: ANONYMOUS_USER_SUB } })
    })
})
