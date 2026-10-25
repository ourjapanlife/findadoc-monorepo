import Fastify, { type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { clientIpFrom } from '@findadoc/utils'
import { createServer } from './server.js'
import { registerRestRoutes } from './rest.js'

/**
 * The HTTP app: MCP on /mcp and the REST/OpenAPI routes, ready but not listening.
 * http.ts listens on a port. lambda.ts passes it Lambda requests.
 *
 * MCP is stateless: every POST gets its own server and transport, and no session is kept.
 * Requests can then land on any Lambda instance. Every tool is a plain request and
 * response over the GraphQL API, so nothing needs a session.
 */
export async function buildMcpApp(): Promise<FastifyInstance> {
    const app = Fastify()

    await app.register(rateLimit, {
        max: 100,
        timeWindow: '15 minutes',
        // per person, not per CloudFront edge
        keyGenerator: request => clientIpFrom(request, process.env.EDGE_SHARED_SECRET),
        errorResponseBuilder: () => ({ error: 'Too many requests, please try again later' })
    })

    // REST + OpenAPI endpoints (for ChatGPT Actions and other OpenAPI clients),
    // served alongside the MCP transport on /mcp.
    await registerRestRoutes(app)

    app.post('/mcp', async (req, res) => {
        const server = createServer()
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        })

        res.raw.on('close', () => {
            void transport.close()
            void server.close()
        })

        await server.connect(transport)
        await transport.handleRequest(req.raw, res.raw, req.body)
        return res.hijack()
    })

    // Stateless: no event stream to resume and no session to end.
    const noSessions = async (_req: unknown, res: { status: (code: number) => { send: (body: unknown) => unknown } }) =>
        res.status(405).send({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed. This server is stateless: POST to /mcp.' },
            id: null
        })

    app.get('/mcp', noSessions)
    app.delete('/mcp', noSessions)

    return app
}
