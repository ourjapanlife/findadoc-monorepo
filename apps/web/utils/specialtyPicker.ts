import type { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import {
    HIDDEN_SPECIALTIES,
    SPECIALTY_GROUP,
    SPECIALTY_JA_ALIASES,
    SPECIALTY_LABELS,
    SPECIALTY_PICKER_GROUPS,
    specialtiesInGroup
} from '@findadoc/utils'

/**
 * The two-step specialty picker (#277): a group first, then the specialties in it, the way search asks
 * for a prefecture before a city. Search and moderation share these rules so they offer the same lists.
 */

export type LabeledOption<T> = { code: T, displayText: string }

/** The group a specialty sits under, so a link with only `?specialty=` still shows its group. */
export function groupOfSpecialty(code: Specialty | '' | undefined): SpecialtyCategory | undefined {
    return code ? SPECIALTY_GROUP[code] : undefined
}

/**
 * The groups to offer, in display order. With live coverage, only groups that hold a specialty some
 * professional practices, plus the one already selected so a shared link still shows it.
 */
export function groupOptions(
    label: (code: SpecialtyCategory) => string,
    available: readonly Specialty[] | undefined,
    selected: SpecialtyCategory | undefined
): LabeledOption<SpecialtyCategory>[] {
    const offered = available ? new Set(available.map(code => SPECIALTY_GROUP[code])) : undefined
    return SPECIALTY_PICKER_GROUPS
        .filter(group => !offered || offered.has(group) || group === selected)
        .map(code => ({ code, displayText: label(code) }))
}

/** The specialties to offer under one group. Nothing until a group is picked, like a city list. */
export function specialtiesForGroup<T extends { code: Specialty }>(
    options: readonly T[],
    group: SpecialtyCategory | undefined
): T[] {
    if (!group) {
        return []
    }
    const inGroup = new Set(specialtiesInGroup(group))
    return options.filter(option => inGroup.has(option.code))
}

function fold(value: string): string {
    return value.normalize('NFKC').toLowerCase().replace(/[\s・･]/g, '')
}

/**
 * Whether a typed query finds a specialty: its label in the reader's language, its English and Japanese
 * labels, a department name a clinic uses (胃腸内科), or its code. Hidden values never match.
 */
export function specialtyMatchesQuery(code: Specialty, label: string, query: string): boolean {
    if (HIDDEN_SPECIALTIES.has(code)) {
        return false
    }
    const target = fold(query)
    if (!target) {
        return true
    }
    const names = [label, SPECIALTY_LABELS[code].nameEn, SPECIALTY_LABELS[code].nameJa, code, ...SPECIALTY_JA_ALIASES[code]]
    return names.some(name => fold(name).includes(target))
}

/** "Gastroenterologist · 消化器内科": the reader's label with the Japanese department name a clinic lists. */
export function bilingualSpecialtyLabel(code: Specialty, label: string): string {
    const japanese = SPECIALTY_LABELS[code].nameJa
    return label === japanese ? label : `${label} · ${japanese}`
}
