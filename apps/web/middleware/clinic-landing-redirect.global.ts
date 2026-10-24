import { clinicLandingMode, clinicLandingRedirectTarget } from '~/utils/clinicLanding'
import { graphqlEndpoint } from '~/utils/graphqlEndpoint'
import { hostedClinicIndex } from '~/utils/hostedClinicIndex'

/**
 * Id addresses (and the prefecture/city form of the same slug) belong to the
 * clean link. The clinic list is the API. Returning `navigateTo` from middleware
 * stops the directory page from answering with its own 404.
 */
export default defineNuxtRouteMiddleware(async to => {
    const config = useRuntimeConfig()
    const mode = clinicLandingMode(config.public.onlineClinic)
    if (mode === 'off' || !to.path.includes('/clinic/')) {
        return
    }

    const sites = await hostedClinicIndex(graphqlEndpoint(config.public.NUXT_USE_LOCAL_API))
    const target = clinicLandingRedirectTarget(to.fullPath, mode, sites)
    if (!target || target === to.fullPath) {
        return
    }
    return navigateTo(target, { redirectCode: 301 })
})
