/**
 * A language's name in the reader's own language: `en_US`, `en-US`, or `en` read
 * as "English" on the English site and "英語" on the Japanese one. Only the
 * language subtag is named, so a region does not turn English into "American English".
 */
const displayNamesCache = new Map<string, Intl.DisplayNames>()

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
    try {
        return displayNames(uiLocale)?.of(subtag) ?? code
    } catch {
        return code
    }
}
