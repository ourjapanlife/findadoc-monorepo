/**
 * Defaults for the Turbo `dev` task. A value already in the environment wins,
 * including `off`. Generate and Netlify do not call this.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {{ localApi?: boolean }} [options]
 * @returns {NodeJS.ProcessEnv}
 */
export function devServerEnv(env, options = {}) {
    const next = { ...env }
    if (!next.NUXT_PUBLIC_ONLINE_CLINIC) {
        next.NUXT_PUBLIC_ONLINE_CLINIC = 'preview'
    }
    if (!next.NUXT_PUBLIC_ADMIN_SITE) {
        next.NUXT_PUBLIC_ADMIN_SITE = 'preview'
    }
    if (options.localApi && !next.NUXT_USE_LOCAL_API) {
        next.NUXT_USE_LOCAL_API = 'true'
    }
    return next
}
