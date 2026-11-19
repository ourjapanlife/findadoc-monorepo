import type { PublishedLocale } from './publishedLocales.js'

/** A spoken language's name in English, in Japanese, and in that language. */
export type LanguageNames = {
    readonly nameEn: string
    readonly nameJa: string
    readonly nameNative: string
}

/**
 * Fixed names for the search-facet languages (#24), so the API's answer does not change with the
 * server's ICU data. Like the site, a name is the language, not the region: `en_US` is English, and
 * `zh_HK` is Traditional Chinese because Hong Kong writes traditional characters.
 * A Record, so a new published locale fails typecheck until it has names.
 */
export const PUBLISHED_LANGUAGE_NAMES: Readonly<Record<PublishedLocale, LanguageNames>> = {
    en_US: { nameEn: 'English', nameJa: '英語', nameNative: 'English' },
    ja_JP: { nameEn: 'Japanese', nameJa: '日本語', nameNative: '日本語' },
    zh_CN: { nameEn: 'Chinese', nameJa: '中国語', nameNative: '中文' },
    ko_KR: { nameEn: 'Korean', nameJa: '韓国語', nameNative: '한국어' },
    tl_PH: { nameEn: 'Tagalog', nameJa: 'タガログ語', nameNative: 'Tagalog' },
    vi_VN: { nameEn: 'Vietnamese', nameJa: 'ベトナム語', nameNative: 'Tiếng Việt' },
    ne_NP: { nameEn: 'Nepali', nameJa: 'ネパール語', nameNative: 'नेपाली' },
    id_ID: { nameEn: 'Indonesian', nameJa: 'インドネシア語', nameNative: 'Bahasa Indonesia' },
    zh_HK: { nameEn: 'Traditional Chinese', nameJa: '繁体字中国語', nameNative: '繁體中文' },
    es_ES: { nameEn: 'Spanish', nameJa: 'スペイン語', nameNative: 'Español' },
    fr_FR: { nameEn: 'French', nameJa: 'フランス語', nameNative: 'Français' },
    ar_AE: { nameEn: 'Arabic', nameJa: 'アラビア語', nameNative: 'العربية' },
    de_DE: { nameEn: 'German', nameJa: 'ドイツ語', nameNative: 'Deutsch' },
    nl_BE: { nameEn: 'Dutch', nameJa: 'オランダ語', nameNative: 'Nederlands' },
    sw_KE: { nameEn: 'Swahili', nameJa: 'スワヒリ語', nameNative: 'Kiswahili' },
    ru_RU: { nameEn: 'Russian', nameJa: 'ロシア語', nameNative: 'Русский' }
}
