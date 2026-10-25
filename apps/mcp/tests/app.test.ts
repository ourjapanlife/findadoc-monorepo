import { describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import type { Context } from 'aws-lambda'

vi.mock('../src/graphql.js', () => ({
    gqlClient: { request: vi.fn() }
}))

process.env.OPENAPI_PATH = fileURLToPath(new URL('../openapi.yaml', import.meta.url))

const { buildMcpApp } = await import('../src/app.js')
const { handler } = await import('../src/lambda.js')

const mcpHeaders = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }

function rpc(id: number, method: string, params: Record<string, unknown> = {}) {
    return { jsonrpc: '2.0', id, method, params }
}

const initialize = rpc(1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'vitest', version: '1.0.0' }
})

describe('stateless MCP app', () => {
    it('answers initialize, then tools/list as a separate request with no session', async () => {
        const app = await buildMcpApp()

        const first = await app.inject({ method: 'POST', url: '/mcp', headers: mcpHeaders, payload: initialize })

        expect(first.statusCode).toBe(200)
        expect(first.headers['mcp-session-id']).toBeUndefined()
        expect(first.json().result.serverInfo).toBeDefined()

        const second = await app.inject({ method: 'POST', url: '/mcp', headers: mcpHeaders, payload: rpc(2, 'tools/list') })

        expect(second.statusCode).toBe(200)
        expect(second.json().result.tools.map((tool: { name: string }) => tool.name)).toContain('search_facilities')
    })

    it('refuses GET and DELETE, which only make sense with sessions', async () => {
        const app = await buildMcpApp()

        expect((await app.inject({ method: 'GET', url: '/mcp' })).statusCode).toBe(405)
        expect((await app.inject({ method: 'DELETE', url: '/mcp' })).statusCode).toBe(405)
    })
})

// The shape a Lambda Function URL sends (payload format 2.0).
function functionUrlEvent(method: string, path: string, body?: unknown) {
    return {
        version: '2.0',
        routeKey: '$default',
        rawPath: path,
        rawQueryString: '',
        headers: { ...mcpHeaders, host: 'example.lambda-url.ap-northeast-1.on.aws' },
        requestContext: {
            http: { method, path, protocol: 'HTTP/1.1', sourceIp: '203.0.113.1', userAgent: 'vitest' },
            requestId: 'mcp-test',
            stage: '$default'
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        isBase64Encoded: false
    }
}

describe('MCP Lambda handler', () => {
    const context = { awsRequestId: 'mcp-test' } as unknown as Context

    it('serves MCP tools/list through the Function URL shape', async () => {
        const response = await handler(functionUrlEvent('POST', '/mcp', rpc(3, 'tools/list')) as never, context)

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.body as string).result.tools.length).toBeGreaterThan(0)
    })

    it('serves the OpenAPI file from OPENAPI_PATH', async () => {
        const response = await handler(functionUrlEvent('GET', '/openapi.yaml') as never, context)

        expect(response.statusCode).toBe(200)
        expect(response.body).toContain('openapi:')
    })
})
