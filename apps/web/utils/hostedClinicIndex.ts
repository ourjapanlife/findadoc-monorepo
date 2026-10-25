import { graphqlEndpoint } from './graphqlEndpoint.ts'
import { clinicLandingPath, isClinicLandingPath, type HostedClinicRef } from './clinicLanding.ts'

const INDEX_QUERY = `query ClinicSites {
  clinicSites {
    slug
    facilityId
    status
    shareImagePath
  }
}`

const INDEX_TTL_MS = 30_000

let indexCache: { at: number, endpoint: string, sites: HostedClinicRef[] } | undefined

/** Preview and published clinics. Drafts are already omitted by the API. */
export async function hostedClinicIndex(endpoint = graphqlEndpoint()): Promise<HostedClinicRef[]> {
    const now = Date.now()
    if (indexCache && indexCache.endpoint === endpoint && now - indexCache.at < INDEX_TTL_MS) {
        return indexCache.sites
    }

    const remember = (sites: HostedClinicRef[]): HostedClinicRef[] => {
        indexCache = { at: now, endpoint, sites }
        return sites
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: INDEX_QUERY }),
            signal: AbortSignal.timeout(4000)
        })
        if (!response.ok) {
            return remember(indexCache?.sites ?? [])
        }
        const body = await response.json() as {
            data?: { clinicSites?: HostedClinicRef[] }
            errors?: unknown[]
        }
        if (body.errors?.length || !body.data?.clinicSites) {
            return remember(indexCache?.sites ?? [])
        }
        const sites = body.data.clinicSites.filter(site => typeof site.slug === 'string' && site.slug.length > 0)
        return remember(sites)
    } catch {
        return remember(indexCache?.sites ?? [])
    }
}

export function hostedClinicForPath(path: string, sites: readonly HostedClinicRef[]): HostedClinicRef | undefined {
    if (!isClinicLandingPath(path)) {
        return undefined
    }
    const slug = path.split('?')[0]?.split('#')[0]?.split('/').filter(Boolean).pop()
    return sites.find(site => site.slug === slug)
}

export function publishedClinicPaths(sites: readonly HostedClinicRef[]): string[] {
    return sites
        .filter(site => site.status === 'PUBLISHED')
        .map(site => clinicLandingPath(site.slug))
}
