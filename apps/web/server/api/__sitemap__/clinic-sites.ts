import { defineEventHandler } from 'h3'
import { clinicLandingsArePublic } from '~/utils/clinicLanding'
import { graphqlEndpoint } from '~/utils/graphqlEndpoint'
import { hostedClinicIndex, publishedClinicPages } from '~/utils/hostedClinicIndex'
import { withLocaleAlternates } from '~/utils/sitemap'

export default defineEventHandler(async () => {
    if (!clinicLandingsArePublic()) {
        return []
    }

    const pages = publishedClinicPages(await hostedClinicIndex(graphqlEndpoint()))
    return pages.flatMap(page => withLocaleAlternates([{ loc: page.path }], page.localeCodes))
})
