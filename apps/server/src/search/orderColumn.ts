/** GraphQL order fields that are real columns. Anything else keeps the list's default order. */
export const SUBMISSION_ORDER_COLUMNS: Record<string, string> = {
    googleMapsUrl: 'google_maps_url',
    healthcareProfessionalName: 'healthcare_professional_name',
    createdDate: 'created_date',
    updatedDate: 'updated_date'
}

export const FACILITY_ORDER_COLUMNS: Record<string, string> = {
    nameEn: 'name_en',
    nameJa: 'name_ja',
    createdDate: 'created_date',
    updatedDate: 'updated_date'
}

export const PROFESSIONAL_ORDER_COLUMNS: Record<string, string> = {
    createdDate: 'created_date',
    updatedDate: 'updated_date'
}

export function databaseOrderColumn(
    field: string | null | undefined,
    columns: Record<string, string>
): string | null {
    if (field === null || field === undefined || field === '') {
        return null
    }
    return columns[field] ?? null
}
