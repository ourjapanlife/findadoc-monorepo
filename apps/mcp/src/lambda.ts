// The MCP server on AWS Lambda, behind a Function URL and CloudFront. Same app as http.ts,
// which listens on a port instead.
import awsLambdaFastify from '@fastify/aws-lambda'
import { buildMcpApp } from './app.js'

const app = await buildMcpApp()

const proxy = awsLambdaFastify(app)

await app.ready()

type ProxyArgs = Parameters<typeof proxy>

// Node 24 on Lambda refuses a handler that takes a callback, and the adapter's does, so the
// exported handler takes only the event and context.
export const handler = async (event: ProxyArgs[0], context: ProxyArgs[1]) => proxy(event, context)
