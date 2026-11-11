/**
 * Locales search may advertise as facets (#1015). The list lives in @findadoc/utils so the web
 * forms offer exactly what the API accepts. It is re-exported here, where the API reads it.
 */
export { isPublishedLocale, PUBLISHED_LOCALES, type PublishedLocale } from '@findadoc/utils'

/** First occurrence wins. Callers that store the list should keep this order. */
export function uniqueLocales<T extends string>(languages: readonly T[]): T[] {
    const seen = new Set<string>()
    const unique: T[] = []

    for (const language of languages) {
        if (seen.has(language)) {
            continue
        }

        seen.add(language)
        unique.push(language)
    }

    return unique
}
