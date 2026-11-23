import { OpeningDay, type OpeningHours } from '@findadoc/graphql'
import { MAX_OPENING_BLOCKS_PER_DAY, openingMinutes } from '@findadoc/utils'

/**
 * Editing rules for the moderation hours editor (#294). A day is open with one or more blocks,
 * and a break is the gap between two blocks: nothing about a break is stored on its own.
 */

/**
 * The step the time pickers offer. Five minutes covers the times clinics publish (08:50, 12:10)
 * and keeps the list short enough to scroll. A saved time off the step still shows as itself.
 */
export const OPENING_STEP_MINUTES = 5
export const END_OF_DAY = '24:00'

const DAY_MINUTES = 24 * 60
const DEFAULT_OPENS = 9 * 60
const DEFAULT_CLOSES = 18 * 60
// The usual Japanese clinic lunch break, used when a break splits a full day.
const LUNCH_STARTS = 12 * 60
const LUNCH_ENDS = 13 * 60
const BREAK_MINUTES = 60
const AFTER_BREAK_MINUTES = 3 * 60

const WEEKDAYS_AFTER_MONDAY: readonly OpeningDay[] = [
    OpeningDay.Tuesday,
    OpeningDay.Wednesday,
    OpeningDay.Thursday,
    OpeningDay.Friday
]

/** 570 → '09:30', 1440 → '24:00'. */
export function timeLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function stepTimes(from: number, to: number): string[] {
    const times: string[] = []
    for (let minutes = from; minutes <= to; minutes += OPENING_STEP_MINUTES) {
        times.push(timeLabel(minutes))
    }
    return times
}

/** Keeps a saved time that is off the step, so opening the form never changes it. */
function withCurrent(times: string[], current: string): string[] {
    if (openingMinutes(current) === null || times.includes(current)) {
        return times
    }
    return [...times, current].sort()
}

/** Every time a block can open at, 00:00 to 23:55. */
export function openingTimeOptions(current: string): string[] {
    return withCurrent(stepTimes(0, DAY_MINUTES - OPENING_STEP_MINUTES), current)
}

/** Every time a block can close at after it opens, up to 24:00 for the end of the day. */
export function closingTimeOptions(opens: string, current: string): string[] {
    const opensAt = openingMinutes(opens) ?? -1
    return withCurrent(stepTimes(OPENING_STEP_MINUTES, DAY_MINUTES), current)
        .filter(time => (openingMinutes(time) ?? 0) > opensAt || time === current)
}

/** One day's blocks, earliest first, with each block's place in the whole list. */
export function blocksForDay(hours: readonly OpeningHours[], day: OpeningDay) {
    return hours
        .map((block, index) => ({ block, index }))
        .filter(entry => entry.block.day === day)
        .sort((left, right) => left.block.opens.localeCompare(right.block.opens))
}

export type OpeningBreak = { from: string, to: string }

/**
 * The gap before each of one day's blocks after the first, for the "Break 12:00–16:30" line:
 * entry n sits between block n and block n + 1, and is null when the blocks touch or overlap.
 */
export function breaksForDay(hours: readonly OpeningHours[], day: OpeningDay): (OpeningBreak | null)[] {
    const blocks = blocksForDay(hours, day).map(entry => entry.block)
    return blocks.slice(1).map((block, position) => {
        const from = openingMinutes(blocks[position]?.closes ?? '')
        const to = openingMinutes(block.opens)
        return from !== null && to !== null && to > from ? { from: timeLabel(from), to: timeLabel(to) } : null
    })
}

/** Opens a closed day at 09:00–18:00. */
export function openDay(hours: readonly OpeningHours[], day: OpeningDay): OpeningHours[] {
    return [...hours, { day, opens: timeLabel(DEFAULT_OPENS), closes: timeLabel(DEFAULT_CLOSES) }]
}

export function closeDay(hours: readonly OpeningHours[], day: OpeningDay): OpeningHours[] {
    return hours.filter(block => block.day !== day)
}

/**
 * Adds a break to a day. A day's last block that spans lunch is split at 12:00–13:00, so a full
 * day becomes morning and afternoon at once. Otherwise a new block starts an hour after the last
 * one closes, or, when that runs past 24:00, the last block is split in its middle. The added
 * block never overlaps one that is there. The moderator then moves either end.
 */
export function addBreak(hours: readonly OpeningHours[], day: OpeningDay): OpeningHours[] {
    const blocks = blocksForDay(hours, day)
    const last = blocks.at(-1)
    if (!last) {
        return openDay(hours, day)
    }
    if (blocks.length >= MAX_OPENING_BLOCKS_PER_DAY) {
        return [...hours]
    }
    const opens = openingMinutes(last.block.opens)
    const closes = openingMinutes(last.block.closes)
    if (opens !== null && closes !== null && opens < LUNCH_STARTS && closes > LUNCH_ENDS) {
        return [
            ...hours.map((block, index) => (index === last.index ? { ...block, closes: timeLabel(LUNCH_STARTS) } : block)),
            { day, opens: timeLabel(LUNCH_ENDS), closes: last.block.closes }
        ]
    }
    const start = (closes ?? DEFAULT_CLOSES) + BREAK_MINUTES
    if (start + OPENING_STEP_MINUTES <= DAY_MINUTES) {
        const after = { day, opens: timeLabel(start), closes: timeLabel(Math.min(start + AFTER_BREAK_MINUTES, DAY_MINUTES)) }
        return [...hours, after]
    }
    return splitInMiddle(hours, last, opens, closes)
}

/**
 * No block fits after the last one (18:00–24:00), so the hour's break goes in its middle instead.
 * A block too short to split keeps its hours: adding one would overlap it.
 */
function splitInMiddle(
    hours: readonly OpeningHours[],
    last: { block: OpeningHours, index: number },
    opens: number | null,
    closes: number | null
): OpeningHours[] {
    if (opens === null || closes === null || closes - opens < BREAK_MINUTES + 2 * OPENING_STEP_MINUTES) {
        return [...hours]
    }
    const half = (closes - opens - BREAK_MINUTES) / 2
    const breakStarts = opens + Math.max(OPENING_STEP_MINUTES, Math.floor(half / OPENING_STEP_MINUTES) * OPENING_STEP_MINUTES)
    return [
        ...hours.map((block, index) => (index === last.index ? { ...block, closes: timeLabel(breakStarts) } : block)),
        { day: last.block.day, opens: timeLabel(breakStarts + BREAK_MINUTES), closes: last.block.closes }
    ]
}

/** Gives Tuesday to Friday the same blocks as Monday. Weekends and public holidays stay as they are. */
export function copyMondayToWeekdays(hours: readonly OpeningHours[]): OpeningHours[] {
    const monday = hours.filter(block => block.day === OpeningDay.Monday)
    return [
        ...hours.filter(block => !WEEKDAYS_AFTER_MONDAY.includes(block.day)),
        ...WEEKDAYS_AFTER_MONDAY.flatMap(day => monday.map(block => ({ ...block, day })))
    ]
}
