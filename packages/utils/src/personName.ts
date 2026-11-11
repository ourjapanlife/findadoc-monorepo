/**
 * A healthcare professional's name is stored in English (romaji) and Japanese only.
 * Other languages were never read by the site and made the moderation form a long list.
 */
export const PERSON_NAME_LOCALES = ['en_US', 'ja_JP'] as const

export type PersonNameLocale = typeof PERSON_NAME_LOCALES[number]

export function isPersonNameLocale(value: string): value is PersonNameLocale {
    return (PERSON_NAME_LOCALES as readonly string[]).includes(value)
}

// Latin letters (macrons for Hepburn romaji, accents for a foreign doctor's own name),
// joined by single spaces, hyphens, apostrophes, or a period after an initial.
const ROMAJI_NAME = /^\p{Script=Latin}+(?:(?:[-'’]|\.? ?)\p{Script=Latin}+)*\.?$/u

// Kanji (with 々 and 〆), hiragana, and katakana (with ー and ・). Spaces may separate parts.
const JAPANESE_NAME = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]+(?: [\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]+)*$/u

const JAPANESE_LETTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

/** True when a name part is written in romaji (Latin script) and nothing else. */
export function isRomajiName(namePart: string): boolean {
    return ROMAJI_NAME.test(namePart.normalize('NFC').trim())
}

/**
 * True when a name part is kanji, hiragana, or katakana and nothing else.
 * NFKC turns half-width katakana and the ideographic space into their usual forms first.
 */
export function isJapaneseName(namePart: string): boolean {
    const normalized = namePart.normalize('NFKC').trim()

    return JAPANESE_NAME.test(normalized) && JAPANESE_LETTER.test(normalized)
}

/** True when a name part is valid for the locale it is written in. */
export function isNamePartValidForLocale(namePart: string, locale: string): boolean {
    switch (locale) {
        case 'en_US':
            return isRomajiName(namePart)
        case 'ja_JP':
            return isJapaneseName(namePart)
        default:
            return false
    }
}
