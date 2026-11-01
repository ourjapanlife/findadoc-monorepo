import { Locale, type SaveClinicInterpreterInput } from '@findadoc/graphql'
import { isWeeklyHours, normalizeWeeklyHours, type WeeklyHours } from '../booking/schedule.js'
import { UUID_REGEX } from './validateFacility.js'

export const MAX_INTERPRETER_LABEL_LENGTH = 80
export const MAX_INTERPRETER_LANGUAGES = 20
export const MAX_INTERPRETER_CAPACITY = 20
export const MAX_INTERPRETER_HOUR_BLOCKS = 50

const LOCALES = new Set<string>(Object.values(Locale))

export type ValidClinicInterpreter = {
    id: string | null
    facilityId: string
    label: string
    languages: Locale[] | null
    capacity: number | null
    hours: WeeklyHours[]
}

function validLanguages(value: readonly string[] | null | undefined): Locale[] | null | undefined {
    if (value === null || value === undefined) {
        return null
    }
    const unique = [...new Set(value)]
    const known = unique.every(language => LOCALES.has(language) && language !== Locale.Und)
    if (!known || unique.length === 0 || unique.length > MAX_INTERPRETER_LANGUAGES) {
        return undefined
    }
    return unique as Locale[]
}

/**
 * Checks an interpreter from the dashboard (#205). Returns the clean value, or the
 * name of the first field that is not valid. Null languages and capacity mean "all".
 */
export function validateClinicInterpreter(
    input: SaveClinicInterpreterInput
): { value: ValidClinicInterpreter } | { field: string } {
    const id = input.id?.trim() || null
    if (id !== null && !UUID_REGEX.test(id)) {
        return { field: 'id' }
    }
    const label = input.label.trim()
    if (label === '' || label.length > MAX_INTERPRETER_LABEL_LENGTH) {
        return { field: 'label' }
    }
    const languages = validLanguages(input.languages)
    if (languages === undefined) {
        return { field: 'languages' }
    }
    const capacity = input.capacity ?? null
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_INTERPRETER_CAPACITY)) {
        return { field: 'capacity' }
    }
    if (input.hours.length > MAX_INTERPRETER_HOUR_BLOCKS || !input.hours.every(isWeeklyHours)) {
        return { field: 'hours' }
    }
    return {
        value: {
            id,
            facilityId: input.facilityId.trim(),
            label,
            languages,
            capacity,
            hours: normalizeWeeklyHours(input.hours)
        }
    }
}
