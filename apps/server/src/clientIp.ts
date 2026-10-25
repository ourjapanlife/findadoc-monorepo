import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'

const EDGE_SECRET_HEADER = 'x-findadoc-edge'
const VIEWER_ADDRESS_HEADER = 'cloudfront-viewer-address'

function header(request: Pick<FastifyRequest, 'headers'>, name: string): string | undefined {
    const value = request.headers?.[name]

    return Array.isArray(value) ? value[0] : value
}

function sameSecret(sent: string, expected: string): boolean {
    const a = Buffer.from(sent)
    const b = Buffer.from(expected)

    return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The address of the person making the request, for rate limits and Places quotas.
 *
 * Behind CloudFront, request.ip is a CloudFront edge address shared by many people.
 * CloudFront sends the viewer's address in CloudFront-Viewer-Address, and the secret
 * EDGE_SHARED_SECRET in x-findadoc-edge. The viewer address is trusted only when that
 * secret matches, so a request sent straight to the Function URL cannot fake it. Its own
 * source address is already the real one.
 */
export function clientIpFrom(
    request: Pick<FastifyRequest, 'headers' | 'ip'>,
    edgeSecret: string | undefined = process.env.EDGE_SHARED_SECRET
): string {
    const viewerAddress = header(request, VIEWER_ADDRESS_HEADER)
    const sentSecret = header(request, EDGE_SECRET_HEADER)

    if (edgeSecret && viewerAddress && sentSecret && sameSecret(sentSecret, edgeSecret)) {
        // "203.0.113.7:46532" or "2001:db8::1:46532": the port follows the last colon.
        const separator = viewerAddress.lastIndexOf(':')

        return separator > 0 ? viewerAddress.slice(0, separator) : viewerAddress
    }

    return request?.ip || 'unknown'
}
