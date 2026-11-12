import {
    Locale,
    type LanguageDefinition,
    type SpecialtyCategoryDefinition,
    type SpecialtyDefinition
} from '@findadoc/graphql'
import {
    categoriesOfSpecialty,
    PUBLISHED_LOCALE_VALUES,
    SPECIALTY_CATEGORY_DISPLAY_ORDER,
    SPECIALTY_CATEGORY_LABELS,
    SPECIALTY_CATEGORY_MEMBERS,
    SPECIALTY_DISPLAY_ORDER,
    SPECIALTY_LABELS
} from '@findadoc/utils'
import { languageNames } from '../languages/languageNames.js'
import { isPublishedLocale } from '../languages/publishedLocales.js'
import type { Result } from '../result.js'

/*
 * The filter vocabulary with labels (#24), so clients do not need schema introspection.
 * The data is static and comes from @findadoc/utils. These services run no query.
 */

/** Every Specialty in display order, with labels and categories. */
export function listSpecialties(): Result<SpecialtyDefinition[]> {
    return {
        data: SPECIALTY_DISPLAY_ORDER.map(code => ({
            code,
            ...SPECIALTY_LABELS[code],
            categories: categoriesOfSpecialty(code)
        })),
        hasErrors: false
    }
}

/** Every SpecialtyCategory in display order, with labels and the specialties it holds. */
export function listSpecialtyCategories(): Result<SpecialtyCategoryDefinition[]> {
    return {
        data: SPECIALTY_CATEGORY_DISPLAY_ORDER.map(code => ({
            code,
            ...SPECIALTY_CATEGORY_LABELS[code],
            specialties: [...SPECIALTY_CATEGORY_MEMBERS[code]]
        })),
        hasErrors: false
    }
}

function languageDefinition(code: Locale): LanguageDefinition {
    return { code, ...languageNames(code), published: isPublishedLocale(code) }
}

/**
 * The search-facet languages in published order. With `publishedOnly` false, every Locale value:
 * the facets first, then the rest in schema order. A null argument means the default, true.
 */
export function listLanguages(publishedOnly: boolean | null | undefined): Result<LanguageDefinition[]> {
    const codes = publishedOnly === false
        ? [...PUBLISHED_LOCALE_VALUES, ...Object.values(Locale).filter(code => !isPublishedLocale(code))]
        : PUBLISHED_LOCALE_VALUES

    return { data: codes.map(languageDefinition), hasErrors: false }
}
