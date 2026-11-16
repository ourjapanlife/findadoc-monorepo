import { Locale, type LocalizedNameInput } from '@findadoc/graphql'
import { hasJapaneseCharacters, hasLatinCharacters } from '~/utils/stringUtils'

/**
 * A professional has two names: romaji (en_US) and Japanese script (ja_JP) (#282).
 * The API refuses any other locale, and only the romaji name has a middle name.
 */
export const PROFESSIONAL_NAME_LOCALES = [Locale.EnUs, Locale.JaJp] as const

export type ProfessionalNameLocale = typeof PROFESSIONAL_NAME_LOCALES[number]

export type ProfessionalNameField = 'firstName' | 'middleName' | 'lastName'

const isComplete = (name: LocalizedNameInput | undefined) =>
    Boolean(name?.firstName.trim() && name.lastName.trim())

/** True when both the romaji and the Japanese name have a first and a last name. */
export function hasBothProfessionalNames(names: readonly LocalizedNameInput[] | undefined): boolean {
    return PROFESSIONAL_NAME_LOCALES.every(locale => isComplete(names?.find(name => name.locale === locale)))
}

/** The stored name for one of the two locales, if there is one. */
export function professionalNameFor(
    names: readonly LocalizedNameInput[],
    locale: ProfessionalNameLocale
): LocalizedNameInput | undefined {
    return names.find(name => name.locale === locale)
}

const isBlank = (name: LocalizedNameInput) =>
    !name.firstName.trim() && !name.lastName.trim() && !(name.middleName ?? '').trim()

/**
 * Returns the names with one field of one locale changed. The romaji name comes first, a name
 * left blank is dropped, and names in other locales are dropped because the API refuses them.
 */
export function withProfessionalNameField(
    names: readonly LocalizedNameInput[],
    locale: ProfessionalNameLocale,
    field: ProfessionalNameField,
    value: string
): LocalizedNameInput[] {
    return PROFESSIONAL_NAME_LOCALES
        .map(current => {
            const stored = professionalNameFor(names, current)
            const name: LocalizedNameInput = stored
                ? { ...stored }
                : { firstName: '', lastName: '', locale: current }
            if (current === locale) {
                name[field] = value
            }
            return name
        })
        .filter(name => !isBlank(name))
}

/** True when a stored list has a name in a locale other than romaji or Japanese. */
export function hasOtherLocaleNames(names: readonly LocalizedNameInput[]): boolean {
    return names.some(name => !PROFESSIONAL_NAME_LOCALES.some(locale => locale === name.locale))
}

/**
 * A submitter types one free-text name. Put it under the locale its script belongs to, so the
 * moderator only fills the other one. Mixed or unknown text goes nowhere.
 */
export function namesFromSubmittedName(parts: readonly string[]): LocalizedNameInput[] {
    const text = parts.join(' ')
    const japanese = hasJapaneseCharacters(text)
    const latin = hasLatinCharacters(text)

    if (parts.length < 2 || parts.length > 3 || japanese === latin) {
        return []
    }
    if (japanese) {
        // Japanese is written family name first: 山田 花子.
        return [{ lastName: parts[0] ?? '', firstName: parts.slice(1).join('・'), locale: Locale.JaJp }]
    }
    return [{
        firstName: parts[0] ?? '',
        ...(parts.length === 3 ? { middleName: parts[1] ?? '' } : {}),
        lastName: parts[parts.length - 1] ?? '',
        locale: Locale.EnUs
    }]
}
