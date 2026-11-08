import { HoursRecurrence } from '@findadoc/graphql'
import {
    cleanHoursRepeat,
    EVERY_WEEK,
    hoursRepeatKey,
    LAST_WEEK_OF_MONTH,
    type CleanHoursRepeat,
    type HoursRepeatRule
} from '@findadoc/utils'
import { addDaysToKey, weekdayOfKey } from '~/utils/booking/japanTime'

/**
 * Editable weekly blocks for the dashboard: a clinic's or doctor's week (#162), or
 * an interpreter's (#205). Each block has a key so Vue can track it while edited.
 * A clinic or doctor block also has a repeat (#203). Interpreter blocks keep the
 * every-week default and send no repeat.
 */

export type EditableBlock = {
    key: number
    weekday: number
    startMinute: number
    endMinute: number
    repeat: CleanHoursRepeat
}

type HoursBlock = { weekday: number, startMinute: number, endMinute: number }

export const HOURS_STEP_MINUTES = 30
export const DAY_MINUTES = 24 * 60
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
/** The intervals the picker offers. The API accepts up to 12; a saved longer one still shows. */
export const PICKER_INTERVAL_WEEKS = [2, 3, 4] as const

let nextKey = 0

export function newBlock(
    weekday: number,
    startMinute: number,
    endMinute: number,
    repeat: CleanHoursRepeat = EVERY_WEEK
): EditableBlock {
    nextKey += 1
    return { key: nextKey, weekday, startMinute, endMinute, repeat: { ...repeat } }
}

/** Saved hours as editable blocks. A repeat the dashboard cannot read becomes every week. */
export function editableBlocks(hours: readonly (HoursBlock & { repeat?: HoursRepeatRule | null })[]): EditableBlock[] {
    return hours.map(block => newBlock(
        block.weekday,
        block.startMinute,
        block.endMinute,
        cleanHoursRepeat(block.repeat, block.weekday) ?? EVERY_WEEK
    ))
}

/** Editable blocks as the interpreter API input, which repeats every week. */
export function hoursInput(blocks: readonly EditableBlock[]): HoursBlock[] {
    return blocks.map(block => ({ weekday: block.weekday, startMinute: block.startMinute, endMinute: block.endMinute }))
}

/** Editable blocks as the clinic or doctor API input, with each repeat. */
export function scheduleHoursInput(blocks: readonly EditableBlock[]): (HoursBlock & { repeat: CleanHoursRepeat })[] {
    return blocks.map(block => ({
        weekday: block.weekday,
        startMinute: block.startMinute,
        endMinute: block.endMinute,
        repeat: { ...block.repeat }
    }))
}

export function blocksForDay(blocks: readonly EditableBlock[], weekday: number): EditableBlock[] {
    return blocks.filter(block => block.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute)
}

/**
 * True when two blocks on one day with the same repeat overlap. Blocks that repeat
 * differently may overlap: an every-week morning and a first-Monday afternoon.
 */
export function blocksOverlap(blocks: readonly EditableBlock[]): boolean {
    return WEEKDAYS.some(weekday => {
        const byRepeat = new Map<string, EditableBlock[]>()
        for (const block of blocksForDay(blocks, weekday)) {
            const key = hoursRepeatKey(block.repeat)
            byRepeat.set(key, [...(byRepeat.get(key) ?? []), block])
        }
        return [...byRepeat.values()].some(sorted =>
            sorted.some((block, index) => index > 0 && block.startMinute < sorted[index - 1]!.endMinute))
    })
}

/** True when a block's last day is before its first day. */
export function blockDatesInvalid(blocks: readonly EditableBlock[]): boolean {
    return blocks.some(block => block.repeat.startsOn !== null && block.repeat.endsOn !== null
      && block.repeat.endsOn < block.repeat.startsOn)
}

/** The first `count` days on this weekday, from the week that holds today. */
export function anchorOptions(weekday: number, weeks: number, todayKey: string): string[] {
    const first = addDaysToKey(todayKey, (weekday - weekdayOfKey(todayKey) + 7) % 7)
    return Array.from({ length: weeks }, (_, index) => addDaysToKey(first, index * 7))
}

/**
 * The same weeks as a saved anchor, moved to one of anchorOptions. A past anchor
 * and the next day in its rhythm open on the same days from today on.
 */
export function upcomingAnchor(anchor: string, weeks: number, todayKey: string): string {
    let next = anchor
    while (next < todayKey) {
        next = addDaysToKey(next, weeks * 7)
    }
    return next
}

/** The repeat picker's value: weekly, interval:N, or monthly:N. */
export function repeatChoice(repeat: CleanHoursRepeat): string {
    if (repeat.recurrence === HoursRecurrence.Interval) {
        return `interval:${repeat.intervalWeeks ?? PICKER_INTERVAL_WEEKS[0]}`
    }
    if (repeat.recurrence === HoursRecurrence.MonthlyNth) {
        return `monthly:${repeat.weekOfMonth ?? 1}`
    }
    return 'weekly'
}

/** The repeat for a picker value, keeping the block's first and last day and, when it still fits, its anchor. */
export function repeatFromChoice(
    choice: string,
    block: EditableBlock,
    todayKey: string
): CleanHoursRepeat {
    const [kind, count] = choice.split(':')
    const bounds = { startsOn: block.repeat.startsOn, endsOn: block.repeat.endsOn }
    const value = Number(count)
    if (kind === 'interval' && Number.isInteger(value)) {
        const options = anchorOptions(block.weekday, value, todayKey)
        const current = block.repeat.anchorDate
        const anchorDate = current !== null && options.includes(current) ? current : options[0] ?? null
        return { ...EVERY_WEEK, ...bounds, recurrence: HoursRecurrence.Interval, intervalWeeks: value, anchorDate }
    }
    if (kind === 'monthly' && Number.isInteger(value)) {
        return { ...EVERY_WEEK, ...bounds, recurrence: HoursRecurrence.MonthlyNth, weekOfMonth: value }
    }
    return { ...EVERY_WEEK, ...bounds }
}

/** A repeat copied to another weekday: an anchor moves to the same week. */
export function repeatOnWeekday(repeat: CleanHoursRepeat, fromWeekday: number, toWeekday: number): CleanHoursRepeat {
    if (repeat.anchorDate === null) {
        return { ...repeat }
    }
    return { ...repeat, anchorDate: addDaysToKey(repeat.anchorDate, toWeekday - fromWeekday) }
}

const NTH_KEYS: Record<number, string> = {
    1: 'clinicDashboard.weeklyHours.firstOfMonth',
    2: 'clinicDashboard.weeklyHours.secondOfMonth',
    3: 'clinicDashboard.weeklyHours.thirdOfMonth',
    4: 'clinicDashboard.weeklyHours.fourthOfMonth',
    [LAST_WEEK_OF_MONTH]: 'clinicDashboard.weeklyHours.lastOfMonth'
}

type Translate = (key: string, named?: Record<string, unknown>) => string

/** How a repeat reads to staff, such as 'Every 2 weeks' or '1st Monday of the month'. */
export function repeatLabel(t: Translate, repeat: HoursRepeatRule, dayLabel: string): string {
    if (repeat.recurrence === HoursRecurrence.Interval) {
        return t('clinicDashboard.weeklyHours.everyNWeeks', { count: repeat.intervalWeeks ?? 0 })
    }
    const nthKey = repeat.recurrence === HoursRecurrence.MonthlyNth ? NTH_KEYS[repeat.weekOfMonth ?? 0] : undefined
    if (nthKey !== undefined) {
        return t(nthKey, { day: dayLabel })
    }
    return t('clinicDashboard.weeklyHours.everyWeek')
}
