import { PUBLISHED_LANGUAGE_NAMES, type LanguageNames } from '@findadoc/utils'
import { isPublishedLocale } from './publishedLocales.js'

const displayNamesCache = new Map<string, Intl.DisplayNames>()

function displayNamesIn(locale: string): Intl.DisplayNames {
    const cached = displayNamesCache.get(locale)

    if (cached !== undefined) {
        return cached
    }

    const names = new Intl.DisplayNames([locale, 'en'], { type: 'language', fallback: 'code' })

    displayNamesCache.set(locale, names)
    return names
}

/** The language subtag of a Locale value. Chinese in Hong Kong and Taiwan is written in traditional characters. */
function languageSubtag(code: string): string {
    const [language = '', region] = code.split('_')

    return language === 'zh' && (region === 'HK' || region === 'TW') ? 'zh-Hant' : language
}

function nameIn(locale: string, subtag: string, code: string): string {
    try {
        return displayNamesIn(locale).of(subtag) ?? code
    } catch {
        return code
    }
}

/** ICU names `und` "root", so the ISO 639 name is fixed here. It has no native name. */
const UNDETERMINED: LanguageNames = { nameEn: 'Undetermined', nameJa: '未確定', nameNative: 'Undetermined' }

/**
 * Names for a Locale value (#24). A published locale uses the fixed names in @findadoc/utils.
 * Any other code is named by the server's ICU data, which is good enough for a code that is not
 * a search facet. A code ICU cannot name falls back to the code.
 */
export function languageNames(code: string): LanguageNames {
    if (isPublishedLocale(code)) {
        return PUBLISHED_LANGUAGE_NAMES[code]
    }

    const subtag = languageSubtag(code)

    if (subtag === 'und') {
        return UNDETERMINED
    }

    return {
        nameEn: nameIn('en', subtag, code),
        nameJa: nameIn('ja', subtag, code),
        nameNative: nameIn(subtag, subtag, code)
    }
}
