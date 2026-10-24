import type { NitroConfig } from 'nitropack'
import { clinicLandingsArePublic } from '../clinicLanding'
import { graphqlEndpoint } from '../graphqlEndpoint'
import { hostedClinicIndex, publishedClinicPaths } from '../hostedClinicIndex'
import { withLocaleVariants } from '../localePath'

/** Published clinic pages join generate only when the feature itself is public. */
export async function applyPublishedClinicSites(nitroConfig: NitroConfig): Promise<void> {
    if (nitroConfig.dev || !clinicLandingsArePublic()) {
        return
    }

    const paths = publishedClinicPaths(await hostedClinicIndex(graphqlEndpoint()))
    if (paths.length === 0) {
        return
    }

    nitroConfig.prerender ??= {}
    const existing = nitroConfig.prerender.routes ?? []
    nitroConfig.prerender.routes = [...existing, ...withLocaleVariants(paths)]
}
