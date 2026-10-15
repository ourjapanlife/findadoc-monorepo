import { ApolloServer } from '@apollo/server'
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify'
import corsPlugin from '@fastify/cors'
import Fastify from 'fastify'
import { addMocksToSchema } from '@graphql-tools/mock'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { initializeLogger, logger } from './logger.js'
import loadSchema from './schema.js'

const port = 4000
const host = '127.0.0.1'

initializeLogger()

const schema = addMocksToSchema({
    schema: makeExecutableSchema({ typeDefs: loadSchema() })
})

const fastify = Fastify()

await fastify.register(corsPlugin, { origin: true })

const apolloServer = new ApolloServer({
    schema,
    introspection: true,
    plugins: [fastifyApolloDrainPlugin(fastify)]
})

await apolloServer.start()

fastify.get('/health', async () => ({ status: 'ok' }))

await fastify.route({
    url: '/',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: fastifyApolloHandler(apolloServer)
})

await fastify.listen({ port, host })

logger.info(`Fake GraphQL server ready at http://${host}:${port}`)
