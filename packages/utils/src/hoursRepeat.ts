import { HoursRecurrence } from '@findadoc/graphql'

/**
 * Which weeks a weekly-hours block applies to (#203). The API and the clinic calendar
 * both read it, so the dashboard shows the same days patients can book.
 *
 * Dates are Japan days as 'YYYY-MM-DD'. Japan has no daylight saving time, so a JST
 * day is plain arithmetic, and two keys compare as strings.
 */

export type HoursRepeatRule = {
    recurrence: HoursRecurrence
    intervalWeeks?: number | null
    anchorDate?: string | null
    weekOfMonth?: number | null
    startsOn?: string | null
    endsOn?: string | null
}

/** Every field set, unused ones null. This is what the API stores and returns. */
export type CleanHoursRepeat = {
    recurrence: HoursRecurrence
    intervalWeeks: number | null
    anchorDate: string | null
    weekOfMonth: number | null
    startsOn: string | null
    endsOn: string | null
}

export const MIN_INTERVAL_WEEKS = 2
export const MAX_INTERVAL_WEEKS = 12
/** 1st to 4th, and -1 for the last, which is the 4th or the 5th. */
export const WEEKS_OF_MONTH = [1, 2, 3, 4, -1] as const
export const LAST_WEEK_OF_MONTH = -1

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export const EVERY_WEEK: CleanHoursRepeat = {
    recurrence: HoursRecurrence.Weekly,
    intervalWeeks: null,
    anchorDate: null,
    weekOfMonth: null,
    startsOn: null,
    endsOn: null
}

/** True for a real calendar day written 'YYYY-MM-DD'. */
export function isDateKey(value: unknown): value is string {
    if (typeof value !== 'string' || !DATE_KEY.test(value)) {
        return false
    }
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** ISO weekday of a 'YYYY-MM-DD' day: 1 Monday to 7 Sunday. */
export function isoWeekdayOfDateKey(dateKey: string): number {
    return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay() || 7
}

function isRecurrence(value: unknown): value is HoursRecurrence {
    return Object.values(HoursRecurrence).some(recurrence => recurrence === value)
}

function isWeekOfMonth(value: unknown): value is number {
    return WEEKS_OF_MONTH.some(week => week === value)
}

/**
 * Checks a repeat for a block on one ISO weekday. Returns the clean rule with the
 * fields this recurrence does not use set to null, or undefined when it is not valid.
 * An INTERVAL anchor must fall on the block's weekday, so it is the first day itself.
 */
export function cleanHoursRepeat(
    repeat: HoursRepeatRule | null | undefined,
    weekday: number
): CleanHoursRepeat | undefined {
    if (repeat === null || repeat === undefined) {
        return EVERY_WEEK
    }
    if (!isRecurrence(repeat.recurrence)) {
        return undefined
    }
    const startsOn = repeat.startsOn ?? null
    const endsOn = repeat.endsOn ?? null
    if ((startsOn !== null && !isDateKey(startsOn)) || (endsOn !== null && !isDateKey(endsOn))) {
        return undefined
    }
    if (startsOn !== null && endsOn !== null && endsOn < startsOn) {
        return undefined
    }
    const clean: CleanHoursRepeat = { ...EVERY_WEEK, recurrence: repeat.recurrence, startsOn, endsOn }
    if (repeat.recurrence === HoursRecurrence.Interval) {
        const weeks = repeat.intervalWeeks
        const anchor = repeat.anchorDate
        if (typeof weeks !== 'number' || !Number.isInteger(weeks)
          || weeks < MIN_INTERVAL_WEEKS || weeks > MAX_INTERVAL_WEEKS) {
            return undefined
        }
        if (!isDateKey(anchor) || isoWeekdayOfDateKey(anchor) !== weekday) {
            return undefined
        }
        return { ...clean, intervalWeeks: weeks, anchorDate: anchor }
    }
    if (repeat.recurrence === HoursRecurrence.MonthlyNth) {
        if (!isWeekOfMonth(repeat.weekOfMonth)) {
            return undefined
        }
        return { ...clean, weekOfMonth: repeat.weekOfMonth }
    }
    return clean
}

function daysInMonth(dateKey: string): number {
    const year = Number(dateKey.slice(0, 4))
    const month = Number(dateKey.slice(5, 7))
    return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * True when a block with this repeat is open on the day. The caller has already
 * matched the block's weekday. Null or undefined is every week.
 */
export function hoursRepeatAppliesOn(repeat: HoursRepeatRule | null | undefined, dateKey: string): boolean {
    if (repeat === null || repeat === undefined) {
        return true
    }
    const startsOn = repeat.startsOn ?? null
    const endsOn = repeat.endsOn ?? null
    if ((startsOn !== null && dateKey < startsOn) || (endsOn !== null && dateKey > endsOn)) {
        return false
    }
    if (repeat.recurrence === HoursRecurrence.Interval) {
        const weeks = repeat.intervalWeeks ?? 0
        const anchor = repeat.anchorDate ?? null
        if (weeks < 1 || anchor === null || dateKey < anchor) {
            return false
        }
        const days = Math.round((Date.parse(`${dateKey}T00:00:00.000Z`) - Date.parse(`${anchor}T00:00:00.000Z`)) / DAY_MS)
        return Math.floor(days / 7) % weeks === 0
    }
    if (repeat.recurrence === HoursRecurrence.MonthlyNth) {
        const day = Number(dateKey.slice(8, 10))
        if (repeat.weekOfMonth === LAST_WEEK_OF_MONTH) {
            return day + 7 > daysInMonth(dateKey)
        }
        return Math.ceil(day / 7) === repeat.weekOfMonth
    }
    return true
}

/** One string per distinct repeat, so blocks are joined only with blocks that repeat the same way. */
export function hoursRepeatKey(repeat: HoursRepeatRule | null | undefined): string {
    const rule = repeat ?? EVERY_WEEK
    return [
        rule.recurrence,
        rule.intervalWeeks ?? '',
        rule.anchorDate ?? '',
        rule.weekOfMonth ?? '',
        rule.startsOn ?? '',
        rule.endsOn ?? ''
    ].join('|')
}
