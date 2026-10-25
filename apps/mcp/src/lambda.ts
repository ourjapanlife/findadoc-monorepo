// The MCP server on AWS Lambda, behind a Function URL and CloudFront. Same app as http.ts,
// which listens on a port instead.
import awsLambdaFastify from '@fastify/aws-lambda'
import { buildMcpApp } from './app.js'

const app = await buildMcpApp()

export const handler = awsLambdaFastify(app)

await app.ready()
