import { Locale, type LocalizedName } from '@findadoc/graphql'

export const formatFirstLocalizedFullName = (names: LocalizedName[] | undefined): string => {
    const firstLocalizedName = names?.[0]
    if (!firstLocalizedName) {
        return ''
    }

    return `${firstLocalizedName.firstName ?? ''} ${firstLocalizedName.lastName ?? ''}`.trim()
}

/**
 * The name a page shows for a professional: the Japanese name on a Japanese page and the romaji
 * name on every other page. The database holds both for every professional (#282), so there is no
 * fallback to the other name. Japanese is family name first.
 */
export const formatHealthcareProfessionalName = (
    names: LocalizedName[] | undefined,
    preferredLocale: Locale
): string => {
    const locale = preferredLocale === Locale.JaJp ? Locale.JaJp : Locale.EnUs
    const name = names?.find(candidate => candidate.locale === locale)
    if (!name) {
        return ''
    }

    return locale === Locale.JaJp
        ? `${name.lastName} ${name.firstName}`.trim()
        : `${name.firstName} ${name.lastName}`.trim()
}
