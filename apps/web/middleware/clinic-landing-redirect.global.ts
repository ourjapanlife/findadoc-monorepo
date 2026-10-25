import { clinicLandingMode, clinicLandingRedirectTarget } from '~/utils/clinicLanding'
import { graphqlEndpoint } from '~/utils/graphqlEndpoint'
import { hostedClinicIndex } from '~/utils/hostedClinicIndex'

/**
 * The subdomain is the clinic. The clean path, the breadcrumb, and the
 * shareable `--{id}` address all leave for `{slug}.findadoc.jp`. Returning
 * `navigateTo` from middleware stops the directory page from answering first.
 */
export default defineNuxtRouteMiddleware(async to => {
    const config = useRuntimeConfig()
    const mode = clinicLandingMode(config.public.onlineClinic)
    if (mode === 'off' || !to.path.includes('/clinic/')) {
        return
    }

    const requestUrl = useRequestURL()
    const sites = await hostedClinicIndex(graphqlEndpoint(config.public.NUXT_USE_LOCAL_API))
    const target = clinicLandingRedirectTarget(to.fullPath, mode, sites, requestUrl.host)
    if (!target || target === to.fullPath) {
        return
    }
    return navigateTo(target, { redirectCode: 301, external: true })
})
