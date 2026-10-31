import { graphqlEndpoint } from './graphqlEndpoint.ts'
import { clinicLandingPath, clinicPageLocaleCodes, type HostedClinicRef } from './clinicLanding.ts'

const INDEX_QUERY = `query ClinicSites {
  clinicSites {
    slug
    facilityId
    status
    shareImagePath
    localeCodes
  }
}`

const INDEX_TTL_MS = 30_000

let indexCache: { at: number, endpoint: string, sites: HostedClinicRef[] } | undefined

async function fetchHostedClinicIndex(endpoint: string): Promise<HostedClinicRef[] | undefined> {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: INDEX_QUERY }),
        signal: AbortSignal.timeout(4000)
    })
    if (!response.ok) {
        return undefined
    }
    const body = await response.json() as {
        data?: { clinicSites?: HostedClinicRef[] }
        errors?: unknown[]
    }
    if ((body.errors?.length ?? 0) > 0 || body.data?.clinicSites === undefined) {
        return undefined
    }
    return body.data.clinicSites.filter(site => typeof site.slug === 'string' && site.slug.length > 0)
}

/** A failed fetch keeps the last good list, or an empty one, so a redirect check never throws. */
async function refreshHostedClinicIndex(endpoint: string, at: number): Promise<HostedClinicRef[]> {
    let sites: HostedClinicRef[] | undefined
    try {
        sites = await fetchHostedClinicIndex(endpoint)
    } catch {
        sites = undefined
    }

    const previous = indexCache?.sites ?? []
    indexCache = { at, endpoint, sites: sites ?? previous }
    return indexCache.sites
}

/**
 * Preview and published clinics. Drafts are already omitted by the API.
 * Cached for 30 seconds per endpoint.
 */
export async function hostedClinicIndex(endpoint = graphqlEndpoint()): Promise<HostedClinicRef[]> {
    const now = Date.now()
    if (indexCache !== undefined && indexCache.endpoint === endpoint && now - indexCache.at < INDEX_TTL_MS) {
        return indexCache.sites
    }

    return refreshHostedClinicIndex(endpoint, now)
}

/** Published clinic pages with the site locales each one exists in. */
export function publishedClinicPages(sites: readonly HostedClinicRef[]): Array<{ path: string, localeCodes: string[] }> {
    return sites
        .filter(site => site.status === 'PUBLISHED')
        .map(site => ({ path: clinicLandingPath(site.slug), localeCodes: clinicPageLocaleCodes(site.localeCodes) }))
}
