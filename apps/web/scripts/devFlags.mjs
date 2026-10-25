/**
 * Defaults for the Turbo `dev` task. The clinic and staff preview cookies do not
 * use an environment variable. This only points the site at the local API when asked.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {{ localApi?: boolean }} [options]
 * @returns {NodeJS.ProcessEnv}
 */
export function devServerEnv(env, options = {}) {
    const next = { ...env }
    if (options.localApi && !next.NUXT_USE_LOCAL_API) {
        next.NUXT_USE_LOCAL_API = 'true'
    }
    return next
}
