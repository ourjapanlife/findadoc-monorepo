// The API on AWS Lambda, behind a Function URL and CloudFront. Same app as index.ts,
// which listens on a port instead.
import './instrument.js'
import * as Sentry from '@sentry/node'
import awsLambdaFastify from '@fastify/aws-lambda'
import { initializeLogger } from './logger.js'
import { initializeKyselyClient } from './kyselyClient.js'
import { buildApiServer } from './server.js'

// Cold start: one logger, one pool, one app, reused by every request this instance serves.
initializeLogger()
await initializeKyselyClient()
const app = await buildApiServer()
const proxy = awsLambdaFastify(app)

await app.ready()

type ProxyArgs = Parameters<typeof proxy>

export const handler = async (event: ProxyArgs[0], context: ProxyArgs[1]) => {
    try {
        return await proxy(event, context)
    } finally {
        // Lambda freezes the instance after the response, so send pending Sentry events first.
        await Sentry.flush(2000)
    }
}
