/** The parts of an HTTP request that clientIpFrom reads. Fastify requests fit this shape. */
export type ClientIpRequest = {
    headers?: Record<string, string | string[] | undefined>
    ip?: string
}

const EDGE_SECRET_HEADER = 'x-findadoc-edge'
const VIEWER_IP_HEADER = 'x-findadoc-viewer-ip'
const VIEWER_COUNTRY_HEADER = 'x-findadoc-viewer-country'

function header(request: ClientIpRequest, name: string): string | undefined {
    const value = request.headers?.[name]

    return Array.isArray(value) ? value[0] : value
}

// Compares every character, so the time taken does not reveal how much of a guess was right.
// No node:crypto: the web app imports this package too.
function sameSecret(sent: string, expected: string): boolean {
    if (sent.length !== expected.length) {
        return false
    }

    let difference = 0

    for (let index = 0; index < sent.length; index++) {
        difference |= sent.charCodeAt(index) ^ expected.charCodeAt(index)
    }

    return difference === 0
}

/**
 * The address of the person making the request, for rate limits and quotas.
 *
 * Behind CloudFront, request.ip is a CloudFront edge address shared by many people.
 * A CloudFront Function writes the viewer's address to x-findadoc-viewer-ip, replacing
 * anything the client sent, and the origin adds the shared secret in x-findadoc-edge.
 * The viewer address is trusted only when that secret matches, so a request sent straight
 * to a Function URL cannot fake it. Its own source address is already the real one.
 */
export function clientIpFrom(request: ClientIpRequest, edgeSecret: string | undefined): string {
    const viewerIp = header(request, VIEWER_IP_HEADER)

    if (viewerIp && fromEdge(request, edgeSecret)) {
        return viewerIp
    }

    return request?.ip || 'unknown'
}

/**
 * The viewer's country as CloudFront sees it, such as `JP`. Undefined when unknown.
 *
 * The same CloudFront Function copies CloudFront-Viewer-Country to x-findadoc-viewer-country,
 * replacing anything the client sent. The value is trusted only with the edge secret,
 * as the viewer address is.
 */
export function viewerCountryFrom(request: ClientIpRequest, edgeSecret: string | undefined): string | undefined {
    const country = header(request, VIEWER_COUNTRY_HEADER)?.trim().toUpperCase()

    if (country && /^[A-Z]{2}$/.test(country) && fromEdge(request, edgeSecret)) {
        return country
    }

    return undefined
}

function fromEdge(request: ClientIpRequest, edgeSecret: string | undefined): boolean {
    const sentSecret = header(request, EDGE_SECRET_HEADER)

    return Boolean(edgeSecret && sentSecret && sameSecret(sentSecret, edgeSecret))
}
