
import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/node'
import Fastify, { type FastifyInstance } from 'fastify'
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify'
import corsPlugin from '@fastify/cors'
import rateLimitPlugin from '@fastify/rate-limit'
import compressionPlugin from '@fastify/compress'
import healthcheck from 'fastify-healthcheck'
import { ApolloServer, GraphQLRequestContext } from '@apollo/server'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { envVariables } from '../utils/environmentVariables.js'
import { isAllowedApiOrigin } from './apiCors.js'
import { apiRateLimitOptions } from './apiRateLimit.js'
import { buildUserContext, initializeAuth } from './auth.js'
import { createLoaders, type ApiContext } from './loaders.js'
import loadSchema from './schema.js'
import resolvers from './resolvers.js'
import { logger } from './logger.js'
import { isServerError, requestErrorFields } from './requestErrors.js'
import { BOOKING_UPLOAD_MAX_BYTES } from './booking/limits.js'
import {
    contentDisposition,
    isSafeBookingObjectKey,
    localBookingContentType,
    readLocalBookingUpload,
    storeLocalBookingUpload
} from './storage/objectStorage.js'

/**
 * Builds the Fastify app with Apollo on `/`, ready to serve but not listening.
 * The long-running server listens on a port. The Lambda handler (lambda.ts) passes it requests.
 */
export const buildApiServer = async (): Promise<FastifyInstance> => {
    logger.info('⛽️ Starting server...')

    //fastify is our http server (a modern, faster alternative to express)
    const fastify = await Fastify()

    //capture unhandled errors thrown inside fastify routes / hooks in Sentry
    Sentry.setupFastifyErrorHandler(fastify)

    //cors is a middleware that allows us to make requests from the a different url (findadoc.jp) to our server (api.findadoc.jp)
    await fastify.register(corsPlugin, {
        origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void): void => {
            cb(null, isAllowedApiOrigin(origin, {
                isLocal: envVariables.isLocal(),
                websiteURL: envVariables.websiteURL()
            }))
        },
        allowedHeaders: ['content-type', 'authorization'],
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
        credentials: true
    })

    //add rate limiting to prevent abuse
    await fastify.register(rateLimitPlugin, apiRateLimitOptions({
        edgeSecret: envVariables.edgeSharedSecret(),
        isProduction: envVariables.isProduction()
    }))

    //add compression to reduce the size of the requests/responses (makes the api faster)
    await fastify.register(compressionPlugin)

    //add healthcheck endpoint. this is what our cloud provider will use to check if the server is healthy (test it here: https://findadoc.jp/healthcheck)
    await fastify.register(healthcheck, {
        healthcheckUrl: '/health'
    })

    // Auth integration
    await initializeAuth(fastify)    

    //set up the apollo graphql server
    const apolloServer = new ApolloServer<ApiContext>({
        typeDefs: loadSchema(),
        resolvers,
        //allows the sandbox to be used in production as well as locally
        introspection: true,
        plugins: [
            fastifyApolloDrainPlugin(fastify),
            //enables the apollo sandbox as the landing page
            ApolloServerPluginLandingPageLocalDefault(),
            {
                async requestDidStart(requestContext: GraphQLRequestContext<ApiContext>) {
                    const startedAt = performance.now()
                    const requestId = requestContext.request.http?.headers.get('x-request-id') ?? randomUUID()

                    return {
                        // One line per request: which operation, how long, and whether it failed.
                        // The query text and variables stay out of the logs. Sentry gets them on errors.
                        // searchFailed drives the search-failure alarm (a metric filter on this line).
                        async willSendResponse(ctx) {
                            //we want to skip logging requests from the apollo query explorer internal introspection query
                            if (ctx.request.query?.includes('IntrospectionQuery')) {
                                return
                            }

                            logger.info('graphql request', {
                                type: 'graphql',
                                requestId,
                                operationName: ctx.operationName ?? ctx.request.operationName ?? null,
                                durationMs: Math.round(performance.now() - startedAt),
                                errorCount: ctx.errors?.length ?? 0,
                                ...requestErrorFields(ctx.operation, ctx.errors)
                            })
                        },
                        async didEncounterErrors(ctx) {
                            //skip errors the client caused (already surfaced via GraphQL response).
                            //a service failure wrapped as BAD_USER_INPUT with a 5xx status still goes to Sentry.
                            for (const err of ctx.errors) {
                                if (!isServerError(err)) {
                                    continue
                                }
                                Sentry.captureException(err, {
                                    tags: { source: 'graphql' },
                                    extra: {
                                        operationName: ctx.request.operationName,
                                        query: ctx.request.query,
                                        variables: ctx.request.variables
                                    }
                                })
                            }
                        }
                    }
                }
            }
        ]
    })

    //this is called instead of startStandaloneServer() since we're using fastify (https://www.apollographql.com/docs/apollo-server/api/apollo-server/#start)
    //the apollo server isn't listening until fastify is actually started. 
    await apolloServer.start()

    //this adds the apollo server to fastify. 
    //Instead of using fastifyApolloHandler(apollo), we use the handler so we can choose the url 
    await fastify.route({
        url: '/',
        method: ['GET', 'POST', 'OPTIONS'],
        handler: fastifyApolloHandler(apolloServer, {
            //this is where we add the Auth0 user authentication to the context. We can access this context in the resolvers
            //each request also gets its own batch loaders for relation ids (see loaders.ts)
            context: async (request): Promise<ApiContext> => ({
                ...await buildUserContext(request),
                loaders: createLoaders()
            })
        })
    })

    // Local booking uploads when STORAGE_BACKEND is not s3. Production uses S3 presigned URLs.
    const bookingUploadTypes = [
        'application/octet-stream',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
    for (const contentType of bookingUploadTypes) {
        fastify.addContentTypeParser(contentType, {
            parseAs: 'buffer',
            bodyLimit: BOOKING_UPLOAD_MAX_BYTES
        }, (_request, body, done) => {
            done(null, body)
        })
    }

    await fastify.route({
        url: '/dev-uploads/*',
        method: ['PUT', 'OPTIONS'],
        handler: async (request, reply) => {
            if (envVariables.storageBackend() === 's3' || !envVariables.isLocal()) {
                return reply.code(404).send({ error: 'Not found' })
            }

            const wildcard = (request.params as { '*': string })['*']
            let objectKey: string
            try {
                objectKey = decodeURIComponent(wildcard ?? '')
            } catch {
                return reply.code(400).send({ error: 'Invalid key' })
            }
            if (!isSafeBookingObjectKey(objectKey)) {
                return reply.code(400).send({ error: 'Invalid key' })
            }

            const contentType = typeof request.headers['content-type'] === 'string'
                ? request.headers['content-type']
                : 'application/octet-stream'
            const body = Buffer.isBuffer(request.body)
                ? request.body
                : Buffer.from(typeof request.body === 'string' ? request.body : '')

            if (body.byteLength === 0) {
                return reply.code(400).send({ error: 'Empty body' })
            }
            if (body.byteLength > BOOKING_UPLOAD_MAX_BYTES) {
                return reply.code(413).send({ error: 'Too large' })
            }

            await storeLocalBookingUpload(objectKey, body, contentType)
            return reply.code(204).send()
        }
    })

    // Local preview and download, the stand-in for the presigned S3 GET.
    await fastify.route({
        url: '/dev-uploads/*',
        method: 'GET',
        handler: async (request, reply) => {
            if (envVariables.storageBackend() === 's3' || !envVariables.isLocal()) {
                return reply.code(404).send({ error: 'Not found' })
            }
            let objectKey: string
            try {
                objectKey = decodeURIComponent((request.params as { '*': string })['*'] ?? '')
            } catch {
                return reply.code(400).send({ error: 'Invalid key' })
            }
            if (!isSafeBookingObjectKey(objectKey)) {
                return reply.code(400).send({ error: 'Invalid key' })
            }
            let body: Buffer
            try {
                body = await readLocalBookingUpload(objectKey)
            } catch {
                return reply.code(404).send({ error: 'Not found' })
            }
            const attachment = (request.query as { disposition?: string }).disposition === 'attachment'
            return reply
                .header('Content-Type', localBookingContentType(objectKey))
                .header('Content-Disposition', contentDisposition(attachment ? 'attachment' : 'inline', objectKey))
                .header('Cache-Control', 'no-store')
                .send(body)
        }
    })

    return fastify
}

export const createApolloFastifyServer = async (customPort?: number): Promise<string> => {
    const fastify = await buildApiServer()

    //start the actual fastify http server
    const serverUrl = await fastify.listen({
        port: customPort ?? parseInt(envVariables.serverPort()),
        host: envVariables.serverHost()
    })

    logger.info(`\n🚀 🚀 🚀 Server ready at: ${serverUrl}\n`)

    return serverUrl
}
