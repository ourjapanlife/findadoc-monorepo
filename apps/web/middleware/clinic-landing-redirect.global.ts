import { useClinicLandingMode, useRequestHost } from '~/composables/useClinicLanding'
import { clinicLandingRedirectTarget } from '~/utils/clinicLanding'
import { graphqlEndpoint } from '~/utils/graphqlEndpoint'
import { hostedClinicIndex } from '~/utils/hostedClinicIndex'

/**
 * The subdomain is the clinic. The clean path, the breadcrumb, and the
 * shareable `--{id}` address all leave for `{slug}.findadoc.jp`. Returning
 * `navigateTo` from middleware stops the directory page from answering first.
 */
export default defineNuxtRouteMiddleware(async to => {
    const mode = useClinicLandingMode()
    if (mode === 'off' || !to.path.includes('/clinic/')) {
        return
    }

    const config = useRuntimeConfig()
    const sites = await hostedClinicIndex(graphqlEndpoint(config.public.NUXT_USE_LOCAL_API))
    const target = clinicLandingRedirectTarget(to.fullPath, mode, sites, useRequestHost().host)
    if (target === undefined) {
        return
    }
    return navigateTo(target, { redirectCode: 301, external: true })
})
