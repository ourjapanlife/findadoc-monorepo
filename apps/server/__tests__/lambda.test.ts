import { describe, expect, it } from 'vitest'
import type { Context } from 'aws-lambda'
import { handler } from '../src/lambda.js'

// The shape a Lambda Function URL sends (payload format 2.0).
function functionUrlEvent(method: string, path: string, body?: unknown) {
    return {
        version: '2.0',
        routeKey: '$default',
        rawPath: path,
        rawQueryString: '',
        headers: {
            'content-type': 'application/json',
            host: 'example.lambda-url.ap-northeast-1.on.aws',
            'x-request-id': 'lambda-test'
        },
        requestContext: {
            accountId: 'anonymous',
            apiId: 'example',
            domainName: 'example.lambda-url.ap-northeast-1.on.aws',
            domainPrefix: 'example',
            http: { method, path, protocol: 'HTTP/1.1', sourceIp: '203.0.113.1', userAgent: 'vitest' },
            requestId: 'lambda-test',
            routeKey: '$default',
            stage: '$default',
            time: '25/Oct/2026:00:00:00 +0000',
            timeEpoch: 1_793_000_000_000
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        isBase64Encoded: false
    }
}

const context = { awsRequestId: 'lambda-test', getRemainingTimeInMillis: () => 10_000 } as unknown as Context

describe('Lambda handler', () => {
    it('answers the health check', async () => {
        const response = await handler(functionUrlEvent('GET', '/health') as never, context)

        expect(response.statusCode).toBe(200)
    })

    it('runs a GraphQL search through the same Fastify app as the server', async () => {
        const response = await handler(functionUrlEvent('POST', '/', {
            query: '{ facilities(filters: { limit: 1 }) { id } facilitiesTotalCount(filters: {}) }'
        }) as never, context)
        const body = JSON.parse(response.body as string)

        expect(response.statusCode).toBe(200)
        expect(body.errors).toBeUndefined()
        expect(Array.isArray(body.data.facilities)).toBe(true)
        expect(typeof body.data.facilitiesTotalCount).toBe('number')
    })
})
