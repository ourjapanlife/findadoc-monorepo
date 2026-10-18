export type LinkedFacilityName = {
    id: string
    nameEn: string
    nameJa: string
}

export function linkedFacilityIds(ids: readonly string[] | null | undefined): string[] {
    const unique: string[] = []
    for (const id of ids ?? []) {
        const trimmed = id.trim()
        if (trimmed && !unique.includes(trimmed)) {
            unique.push(trimmed)
        }
    }
    return unique
}

export function facilityLinkLabel(facility: LinkedFacilityName): string {
    const names = [facility.nameEn, facility.nameJa].map(name => name.trim()).filter(Boolean)
    return names.length ? names.join(' · ') : facility.id
}

export function addFacilityLink(current: readonly string[] | null | undefined, facilityId: string): string[] {
    return linkedFacilityIds([...(current ?? []), facilityId])
}

export function removeFacilityLink(current: readonly string[] | null | undefined, facilityId: string): string[] {
    return linkedFacilityIds(current).filter(id => id !== facilityId)
}

export function facilitiesForIds(
    ids: readonly string[] | null | undefined,
    known: ReadonlyMap<string, LinkedFacilityName>
): LinkedFacilityName[] {
    return linkedFacilityIds(ids).map(id => known.get(id) ?? { id, nameEn: '', nameJa: '' })
}
