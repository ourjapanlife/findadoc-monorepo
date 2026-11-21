import { OpeningDay, type OpeningHours, type OpeningHoursInput } from '@findadoc/graphql'

/**
 * Published opening hours on a facility (#294). Times are Japan time, HH:MM on a 24-hour clock.
 * An empty list is unknown. Once any block is known, a day with no block is closed.
 */

/** Days in the order the form and the clinic page show them. Public holidays come last. */
export const OPENING_DAYS: readonly OpeningDay[] = [
    OpeningDay.Monday,
    OpeningDay.Tuesday,
    OpeningDay.Wednesday,
    OpeningDay.Thursday,
    OpeningDay.Friday,
    OpeningDay.Saturday,
    OpeningDay.Sunday,
    OpeningDay.PublicHoliday
]

/** A clinic with a split day (morning and afternoon) needs two. Four covers every real case we have seen. */
export const MAX_OPENING_BLOCKS_PER_DAY = 4

/** Matches the CHECK in the facility hours migration. */
export const MAX_OPENING_BLOCKS = OPENING_DAYS.length * MAX_OPENING_BLOCKS_PER_DAY

/** Longest visitor note the API accepts, in each language. */
export const ADDITIONAL_INFO_MAX_LENGTH = 1000

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isOpeningDay(value: unknown): value is OpeningDay {
    return typeof value === 'string' && (OPENING_DAYS as readonly string[]).includes(value)
}

/** Minutes after midnight for HH:MM, or null when the text is not a time. 24:00 is the end of the day. */
export function openingMinutes(value: string): number | null {
    if (value === '24:00') {
        return 24 * 60
    }
    if (!TIME.test(value)) {
        return null
    }
    const [hours, minutes] = value.split(':').map(Number)

    return (hours ?? 0) * 60 + (minutes ?? 0)
}

export type OpeningHoursProblem =
    | 'too_many'
    | 'unknown_day'
    | 'bad_time'
    | 'closes_before_opens'
    | 'too_many_on_day'
    | 'overlap'

/** Why an hours list from a form or the API cannot be saved, or null when it can. */
export function openingHoursProblem(blocks: readonly OpeningHoursInput[]): OpeningHoursProblem | null {
    if (blocks.length > MAX_OPENING_BLOCKS) {
        return 'too_many'
    }

    const byDay = new Map<OpeningDay, Array<[number, number]>>()

    for (const block of blocks) {
        if (!isOpeningDay(block.day)) {
            return 'unknown_day'
        }
        // 24:00 only closes a day. A block cannot open at the end of the day.
        const opens = block.opens === '24:00' ? null : openingMinutes(block.opens)
        const closes = openingMinutes(block.closes)

        if (opens === null || closes === null) {
            return 'bad_time'
        }
        if (closes <= opens) {
            return 'closes_before_opens'
        }
        const day = byDay.get(block.day) ?? []
        day.push([opens, closes])
        byDay.set(block.day, day)
    }

    for (const ranges of byDay.values()) {
        if (ranges.length > MAX_OPENING_BLOCKS_PER_DAY) {
            return 'too_many_on_day'
        }
        const sorted = [...ranges].sort((a, b) => a[0] - b[0])
        const overlaps = sorted.some((range, index) => index > 0 && range[0] < (sorted[index - 1]?.[1] ?? 0))

        if (overlaps) {
            return 'overlap'
        }
    }

    return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidBlock(entry: unknown): entry is OpeningHours {
    return isRecord(entry)
        && isOpeningDay(entry.day)
        && typeof entry.opens === 'string'
        && typeof entry.closes === 'string'
        && openingHoursProblem([{ day: entry.day, opens: entry.opens, closes: entry.closes }]) === null
}

/**
 * The stored or submitted list ordered by day, then opening time, with only valid blocks.
 * A stored value can be a JSON string, an array, or anything else; anything else is unknown.
 */
export function normalizeOpeningHours(value: unknown): OpeningHours[] {
    let parsed: unknown = value

    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value)
        } catch {
            return []
        }
    }
    if (!Array.isArray(parsed)) {
        return []
    }

    return parsed
        .filter(isValidBlock)
        .map(block => ({ day: block.day, opens: block.opens, closes: block.closes }))
        .sort((a, b) => OPENING_DAYS.indexOf(a.day) - OPENING_DAYS.indexOf(b.day)
            || (openingMinutes(a.opens) ?? 0) - (openingMinutes(b.opens) ?? 0))
}

/** Trimmed note text, or null for blank. */
export function cleanAdditionalInfo(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? ''

    return trimmed === '' ? null : trimmed
}
