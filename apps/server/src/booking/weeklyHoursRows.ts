import { HoursRecurrence } from '@findadoc/graphql'
import type { CleanHoursRepeat } from '@findadoc/utils'

/**
 * clinic_weekly_hours repeat columns (#203). The column holds lowercase words; GraphQL
 * uses HoursRecurrence. This is the one place that maps between them.
 */
const RECURRENCE_COLUMN = {
    [HoursRecurrence.Weekly]: 'weekly',
    [HoursRecurrence.Interval]: 'interval',
    [HoursRecurrence.MonthlyNth]: 'monthly_nth'
} as const satisfies Record<HoursRecurrence, string>

/** The columns that hold a block's repeat. */
export const REPEAT_COLUMNS = [
    'recurrence',
    'interval_weeks',
    'anchor_date',
    'week_of_month',
    'starts_on',
    'ends_on'
] as const

export type RepeatRow = {
    recurrence: string
    interval_weeks: number | null
    anchor_date: string | null
    week_of_month: number | null
    starts_on: string | null
    ends_on: string | null
}

function recurrenceFromColumn(value: string): HoursRecurrence {
    if (value === RECURRENCE_COLUMN[HoursRecurrence.Interval]) {
        return HoursRecurrence.Interval
    }
    if (value === RECURRENCE_COLUMN[HoursRecurrence.MonthlyNth]) {
        return HoursRecurrence.MonthlyNth
    }
    return HoursRecurrence.Weekly
}

export function repeatFromRow(row: RepeatRow): CleanHoursRepeat {
    return {
        recurrence: recurrenceFromColumn(row.recurrence),
        intervalWeeks: row.interval_weeks,
        anchorDate: row.anchor_date,
        weekOfMonth: row.week_of_month,
        startsOn: row.starts_on,
        endsOn: row.ends_on
    }
}

export function repeatColumns(repeat: CleanHoursRepeat): RepeatRow {
    return {
        recurrence: RECURRENCE_COLUMN[repeat.recurrence],
        interval_weeks: repeat.intervalWeeks,
        anchor_date: repeat.anchorDate,
        week_of_month: repeat.weekOfMonth,
        starts_on: repeat.startsOn,
        ends_on: repeat.endsOn
    }
}
