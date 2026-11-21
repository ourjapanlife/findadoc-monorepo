import type { Locale } from '@findadoc/graphql'

/**
 * Checks or unchecks one facility language. The result follows the order of `options`
 * (English first, Japanese next), so the saved list reads the same way search shows it.
 */
export function toggleSupportedLanguage(
    selected: readonly Locale[],
    language: Locale,
    checked: boolean,
    options: readonly Locale[]
): Locale[] {
    if (!checked) {
        return selected.filter(current => current !== language)
    }

    return options.filter(option => option === language || selected.includes(option))
}

/**
 * The facility languages to send on update, or undefined when the moderator left them as they
 * were. Order does not count as a change. An empty list clears the facility's languages (#21).
 */
export function changedSupportedLanguages(
    current: readonly Locale[],
    original: readonly Locale[] | null | undefined
): Locale[] | undefined {
    const previous = new Set(original ?? [])
    const next = new Set(current)
    const unchanged = previous.size === next.size && [...next].every(language => previous.has(language))

    return unchanged ? undefined : [...current]
}
