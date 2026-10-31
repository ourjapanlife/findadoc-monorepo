import type { NitroConfig } from 'nitropack'
import { clinicLandingsArePublic } from '../clinicLanding'
import { graphqlEndpoint } from '../graphqlEndpoint'
import { hostedClinicIndex, publishedClinicPages } from '../hostedClinicIndex'
import { withLocales } from '../localePath'

/** Published clinic pages join generate only when the feature itself is public. */
export async function applyPublishedClinicSites(nitroConfig: NitroConfig): Promise<void> {
    if (nitroConfig.dev || !clinicLandingsArePublic()) {
        return
    }

    const pages = publishedClinicPages(await hostedClinicIndex(graphqlEndpoint()))
    if (pages.length === 0) {
        return
    }

    // Only the locales each clinic has copy for. Any other locale redirects to English.
    nitroConfig.prerender ??= {}
    const existing = nitroConfig.prerender.routes ?? []
    nitroConfig.prerender.routes = [
        ...existing,
        ...pages.flatMap(page => withLocales([page.path], page.localeCodes))
    ]
}
