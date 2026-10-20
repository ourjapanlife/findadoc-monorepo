/**
 * Value for `runtimeConfig.public` on a static generate.
 * An unset `process.env` read is `undefined`, and Nuxt then writes the env var's name
 * into the client bundle. The browser was sending that name to Sentry and to Google.
 * An empty string stays empty.
 */
export function publicRuntimeValue(nuxtName: string, legacyName?: string): string {
    const fromNuxt = process.env[nuxtName]
    const fromLegacy = legacyName === undefined ? undefined : process.env[legacyName]
    const value = (fromNuxt || fromLegacy || '').trim()
    if (value === '' || value === nuxtName || value === legacyName || value.startsWith('NUXT_')) {
        return ''
    }
    return value
}

/** A Sentry DSN is `https://<key>@<host>/<project>`. The env var's name is not one. */
export function isSentryDsn(value: unknown): value is string {
    if (typeof value !== 'string' || value === '' || value.startsWith('NUXT_')) {
        return false
    }
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && url.username !== '' && url.pathname.length > 1
    } catch {
        return false
    }
}

/** Browser Maps keys start with this. The env var's name does not. */
export function isGoogleMapsApiKey(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('AIza')
}
