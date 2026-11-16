import type { Locale, Specialty } from '@findadoc/graphql'
import { DEFAULT_LOCALE_CODE } from './localePath'
import { languageName } from './languageName'

/**
 * Locales that read a Japanese place in its kanji name. Chinese readers know Japanese
 * places as 東京都 or 港区, not as romaji. Every other locale gets the romaji name: the
 * directory holds no Hangul, Vietnamese, or other spellings.
 */
const KANJI_PLACE_NAME_LOCALE_CODES = new Set(['ja-JP', 'zh-CN'])

/** A place name for a hub page: kanji for Japanese and Chinese, romaji otherwise. */
export function hubPlaceName(nameEn: string, nameJa: string | null | undefined, uiLocale: string): string {
    return KANJI_PLACE_NAME_LOCALE_CODES.has(uiLocale) && nameJa ? nameJa : nameEn
}

/** `ALLERGY_AND_IMMUNOLOGY` → `allergyAndImmunology`, the key under `specialties` in the locale files. */
export function specialtyMessageKey(specialty: Specialty): string {
    return specialty
        .toLowerCase()
        .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

export type HubFacetLabelSource = {
    kind: 'specialty' | 'language'
    /** English facet label, as indexed today ("Dentistry", "English"). */
    label: string
    specialty?: Specialty
    locale?: Locale
}

type Translate = (key: string) => string

/** The fields `hubFacetLabel` reads, copied off a facet so a chip does not carry its facilities. */
export function hubFacetLabelSource(facet: HubFacetLabelSource): HubFacetLabelSource {
    return { kind: facet.kind, label: facet.label, specialty: facet.specialty, locale: facet.locale }
}

/**
 * A facet's name in the reader's language. Languages use `Intl.DisplayNames` ("英語").
 * Specialties use the `specialties` messages ("歯科", "牙医"), except in English, which
 * keeps the field name ("Dentistry in Tokyo") its indexed titles already use.
 */
export function hubFacetLabel(facet: HubFacetLabelSource, uiLocale: string, t: Translate): string {
    if (facet.kind === 'language') {
        return facet.locale ? languageName(facet.locale, uiLocale) : facet.label
    }
    if (!facet.specialty || uiLocale === DEFAULT_LOCALE_CODE) {
        return facet.label
    }
    return t(`specialties.${specialtyMessageKey(facet.specialty)}`)
}
