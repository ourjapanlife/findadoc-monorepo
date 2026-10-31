/**
 * A language's name in the reader's own language: `en_US`, `en-US`, or `en` read
 * as "English" on the English site and "英語" on the Japanese one. Only the
 * language subtag is named, so a region does not turn English into "American English".
 */
const displayNamesCache = new Map<string, Intl.DisplayNames>()

/**
 * Endonyms for languages the browser's ICU data may not name. Chromium has no
 * Nepali names, so a Nepali page would otherwise list every language in English.
 */
const ENDONYMS: Record<string, string> = {
    ne: 'नेपाली'
}

function hasLocaleData(uiLocale: string): boolean {
    try {
        return Intl.DisplayNames.supportedLocalesOf([uiLocale]).length > 0
    } catch {
        return false
    }
}

function displayNames(uiLocale: string): Intl.DisplayNames | undefined {
    const key = uiLocale.replace('_', '-') || 'en'
    const cached = displayNamesCache.get(key)
    if (cached !== undefined) {
        return cached
    }
    try {
        const names = new Intl.DisplayNames([key, 'en'], { type: 'language' })
        displayNamesCache.set(key, names)
        return names
    } catch {
        return undefined
    }
}

export function languageName(code: string, uiLocale: string): string {
    const parts = code.replace('_', '-').split('-')
    const language = parts[0] ?? ''
    // Chinese in Hong Kong is written in traditional characters; keep the region so it reads differently.
    const subtag = language === 'zh' && parts[1] === 'HK' ? 'zh-Hant' : language
    if (subtag === '' || subtag === 'und') {
        return code
    }
    // A reader whose language the browser cannot name in sees each language in its own
    // name ("中文", "Tiếng Việt") rather than in English.
    const readerLocale = uiLocale.replace('_', '-') || 'en'
    const namingLocale = hasLocaleData(readerLocale) ? readerLocale : subtag
    if (namingLocale === subtag && ENDONYMS[subtag] !== undefined) {
        return ENDONYMS[subtag]
    }
    try {
        return displayNames(namingLocale)?.of(subtag) ?? code
    } catch {
        return code
    }
}
