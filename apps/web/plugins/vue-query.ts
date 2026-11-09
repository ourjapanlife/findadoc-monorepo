import { VueQueryPlugin } from '@tanstack/vue-query'
import { defineNuxtPlugin } from '#app'
import { createAppQueryClient } from '~/utils/queryClient'

/**
 * Installs vue-query with the app's defaults (#242). One client per Nuxt app, so a prerender
 * never shares a cache between pages. Reads run in the browser only for now: nothing is
 * fetched during prerender, and there is no dehydrated state to hand over.
 *
 * `pre`, so the client exists before any plugin that might fail, such as Auth0. Public reads
 * do not need a session.
 */
export default defineNuxtPlugin({
    name: 'vue-query',
    enforce: 'pre',
    setup(nuxtApp) {
        const queryClient = createAppQueryClient()
        nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

        return { provide: { queryClient } }
    }
})
