import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'

const EDGE_SECRET_HEADER = 'x-findadoc-edge'
const VIEWER_IP_HEADER = 'x-findadoc-viewer-ip'

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
 * A CloudFront Function writes the viewer's address to x-findadoc-viewer-ip, replacing
 * anything the client sent, and the origin adds the secret EDGE_SHARED_SECRET in
 * x-findadoc-edge. The viewer address is trusted only when that secret matches, so a
 * request sent straight to the Function URL cannot fake it. Its own source address is
 * already the real one.
 */
export function clientIpFrom(
    request: Pick<FastifyRequest, 'headers' | 'ip'>,
    edgeSecret: string | undefined = process.env.EDGE_SHARED_SECRET
): string {
    const viewerIp = header(request, VIEWER_IP_HEADER)
    const sentSecret = header(request, EDGE_SECRET_HEADER)

    if (edgeSecret && viewerIp && sentSecret && sameSecret(sentSecret, edgeSecret)) {
        return viewerIp
    }

    return request?.ip || 'unknown'
}
