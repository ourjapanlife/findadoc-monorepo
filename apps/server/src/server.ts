
import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/node'
import Fastify from 'fastify'
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify'
import corsPlugin from '@fastify/cors'
import rateLimitPlugin from '@fastify/rate-limit'
import compressionPlugin from '@fastify/compress'
import healthcheck from 'fastify-healthcheck'
import { ApolloServer, GraphQLRequestContext } from '@apollo/server'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { envVariables } from '../utils/environmentVariables.js'
import { isAllowedApiOrigin } from './apiCors.js'
import { buildUserContext, initializeAuth } from './auth.js'
import { createLoaders, type ApiContext } from './loaders.js'
import loadSchema from './schema.js'
import resolvers from './resolvers.js'
import { logger } from './logger.js'

export const createApolloFastifyServer = async (customPort?: number): Promise<string> => {
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
        // methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
    })

    //add rate limiting to prevent abuse
    await fastify.register(rateLimitPlugin, {
        max: 100,
        timeWindow: '1 minute'
    })

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
                                errorCount: ctx.errors?.length ?? 0
                            })
                        },
                        async didEncounterErrors(ctx) {
                            //skip user-input validation errors (already surfaced via GraphQL response)
                            for (const err of ctx.errors) {
                                if (err.extensions?.code === 'BAD_USER_INPUT'
                                    || err.extensions?.code === 'UNAUTHORIZED') {
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

    //start the actual fastify http server
    const serverUrl = await fastify.listen({
        port: customPort ?? parseInt(envVariables.serverPort()),
        host: envVariables.serverHost()
    })

    logger.info(`\n🚀 🚀 🚀 Server ready at: ${serverUrl}\n`)

    return serverUrl
}
