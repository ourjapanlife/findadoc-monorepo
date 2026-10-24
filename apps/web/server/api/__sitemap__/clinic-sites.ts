import { defineEventHandler } from 'h3'
import { clinicLandingsArePublic } from '~/utils/clinicLanding'
import { graphqlEndpoint } from '~/utils/graphqlEndpoint'
import { hostedClinicIndex, publishedClinicPaths } from '~/utils/hostedClinicIndex'
import { withLocaleAlternates } from '~/utils/sitemap'

export default defineEventHandler(async () => {
    if (!clinicLandingsArePublic()) {
        return []
    }

    const paths = publishedClinicPaths(await hostedClinicIndex(graphqlEndpoint()))
    return withLocaleAlternates(paths.map(loc => ({ loc })))
})
