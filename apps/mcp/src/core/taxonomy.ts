import { gql } from 'graphql-request'
import type {
    LanguageDefinition,
    SpecialtyCategory,
    SpecialtyCategoryDefinition,
    SpecialtyDefinition
} from '@findadoc/graphql'
import { gqlClient } from '../graphql.js'

// The API serves the filter vocabulary with labels (#24), so MCP no longer introspects the schema.

const LIST_SPECIALTIES = gql`
    query ListSpecialties {
        specialties { code nameEn nameJa categories }
        specialtyCategories { code nameEn nameJa specialties }
    }
`

const LIST_LANGUAGES = gql`
    query ListLanguages($publishedOnly: Boolean) {
        languages(publishedOnly: $publishedOnly) { code nameEn nameJa nameNative published }
    }
`

// Not named Specialty or Language: @findadoc/graphql exports those names as enums.
export type SpecialtyEntry = Omit<SpecialtyDefinition, '__typename'>
export type CategoryEntry = Omit<SpecialtyCategoryDefinition, '__typename'>
export type LanguageEntry = Omit<LanguageDefinition, '__typename'>

export interface SpecialtiesResult {
    count: number
    specialties: SpecialtyEntry[]
    categories: CategoryEntry[]
}

export interface LanguagesResult {
    count: number
    languages: LanguageEntry[]
}

/**
 * Specialties with labels and the categories that group them. With a category, only that
 * category and its specialties, so an agent can turn "mental health" into codes. Those come in
 * the category's own order, whose first entry is the homepage tile's specialty.
 */
export async function listSpecialties(category?: SpecialtyCategory): Promise<SpecialtiesResult> {
    const data = await gqlClient.request<{ specialties: SpecialtyEntry[], specialtyCategories: CategoryEntry[] }>(
        LIST_SPECIALTIES
    )

    if (category === undefined) {
        return { count: data.specialties.length, specialties: data.specialties, categories: data.specialtyCategories }
    }

    const categories = data.specialtyCategories.filter(entry => entry.code === category)
    const byCode = new Map(data.specialties.map(specialty => [specialty.code, specialty]))
    const specialties = (categories[0]?.specialties ?? [])
        .map(code => byCode.get(code))
        .filter((specialty): specialty is SpecialtyEntry => specialty !== undefined)

    return { count: specialties.length, specialties, categories }
}

/** The search-facet languages, or every Locale code when `includeUnpublished` is true. */
export async function listLanguages(includeUnpublished = false): Promise<LanguagesResult> {
    const data = await gqlClient.request<{ languages: LanguageEntry[] }>(
        LIST_LANGUAGES,
        { publishedOnly: !includeUnpublished }
    )

    return { count: data.languages.length, languages: data.languages }
}
