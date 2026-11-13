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

export type Specialty = Omit<SpecialtyDefinition, '__typename'>
export type Category = Omit<SpecialtyCategoryDefinition, '__typename'>
export type Language = Omit<LanguageDefinition, '__typename'>

export interface SpecialtiesResult {
    count: number
    specialties: Specialty[]
    categories: Category[]
}

export interface LanguagesResult {
    count: number
    languages: Language[]
}

/**
 * Specialties with labels and the categories that group them. With a category, only that
 * category's specialties and that category, so an agent can turn "mental health" into codes.
 */
export async function listSpecialties(category?: SpecialtyCategory): Promise<SpecialtiesResult> {
    const data = await gqlClient.request<{ specialties: Specialty[], specialtyCategories: Category[] }>(
        LIST_SPECIALTIES
    )
    const specialties = category === undefined
        ? data.specialties
        : data.specialties.filter(specialty => specialty.categories.includes(category))
    const categories = category === undefined
        ? data.specialtyCategories
        : data.specialtyCategories.filter(entry => entry.code === category)

    return { count: specialties.length, specialties, categories }
}

/** The search-facet languages, or every Locale code when `includeUnpublished` is true. */
export async function listLanguages(includeUnpublished = false): Promise<LanguagesResult> {
    const data = await gqlClient.request<{ languages: Language[] }>(
        LIST_LANGUAGES,
        { publishedOnly: !includeUnpublished }
    )

    return { count: data.languages.length, languages: data.languages }
}
