import { Locale } from '@findadoc/graphql'

/**
 * Locales search may advertise as facets (#1015), and the languages a clinic may list.
 * Order matches the directory: English, Japanese, then the languages we publish.
 * The API and the forms read this one list, so a form never offers less than the API accepts.
 * A Locale value that is not in this list is not a facet, even if an old row still stores it.
 */
export const PUBLISHED_LOCALES = [
    'en_US',
    'ja_JP',
    'zh_CN',
    'ko_KR',
    'tl_PH',
    'vi_VN',
    'ne_NP',
    'id_ID',
    'zh_HK',
    'es_ES',
    'fr_FR',
    'ar_AE',
    'de_DE',
    'nl_BE',
    'sw_KE',
    'ru_RU'
] as const satisfies readonly `${Locale}`[]

export type PublishedLocale = typeof PUBLISHED_LOCALES[number]

const PUBLISHED = new Set<string>(PUBLISHED_LOCALES)

export function isPublishedLocale(value: string): value is PublishedLocale {
    return PUBLISHED.has(value)
}

/** The published locales as Locale values, in published order. */
export const PUBLISHED_LOCALE_VALUES: readonly Locale[] = PUBLISHED_LOCALES
    .flatMap(code => Object.values(Locale).filter(locale => locale === code))
