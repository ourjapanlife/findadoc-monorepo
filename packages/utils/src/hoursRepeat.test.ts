import { HoursRecurrence } from '@findadoc/graphql'
import { describe, expect, it } from 'vitest'
import { cleanHoursRepeat, hoursRepeatAppliesOn, hoursRepeatKey, isDateKey } from './hoursRepeat.js'

const everyOtherMonday = {
    recurrence: HoursRecurrence.Interval,
    intervalWeeks: 2,
    anchorDate: '2026-11-02'
}

describe('hoursRepeatAppliesOn', () => {
    it('opens every week when there is no rule', () => {
        expect(hoursRepeatAppliesOn(null, '2026-11-09')).toBe(true)
        expect(hoursRepeatAppliesOn({ recurrence: HoursRecurrence.Weekly }, '2026-11-09')).toBe(true)
    })

    it('opens every other week from the anchor across a month boundary', () => {
        const mondays = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14']
        expect(mondays.filter(day => hoursRepeatAppliesOn(everyOtherMonday, day)))
            .toEqual(['2026-11-02', '2026-11-16', '2026-11-30', '2026-12-14'])
    })

    it('stays on the same weeks across a year boundary', () => {
        expect(hoursRepeatAppliesOn(everyOtherMonday, '2026-12-28')).toBe(true)
        expect(hoursRepeatAppliesOn(everyOtherMonday, '2027-01-04')).toBe(false)
        expect(hoursRepeatAppliesOn(everyOtherMonday, '2027-01-11')).toBe(true)
    })

    it('does not open before the anchor', () => {
        expect(hoursRepeatAppliesOn(everyOtherMonday, '2026-10-19')).toBe(false)
    })

    it('opens on the nth weekday of the month', () => {
        const firstMonday = { recurrence: HoursRecurrence.MonthlyNth, weekOfMonth: 1 }
        expect(hoursRepeatAppliesOn(firstMonday, '2026-11-02')).toBe(true)
        expect(hoursRepeatAppliesOn(firstMonday, '2026-11-09')).toBe(false)
        expect(hoursRepeatAppliesOn(firstMonday, '2026-12-07')).toBe(true)
        const fourthMonday = { recurrence: HoursRecurrence.MonthlyNth, weekOfMonth: 4 }
        expect(hoursRepeatAppliesOn(fourthMonday, '2026-11-23')).toBe(true)
        expect(hoursRepeatAppliesOn(fourthMonday, '2026-11-30')).toBe(false)
    })

    it('opens on the last weekday in a month with five of them', () => {
        const lastMonday = { recurrence: HoursRecurrence.MonthlyNth, weekOfMonth: -1 }
        // November 2026 has five Mondays: the 30th is the last, not the 23rd.
        expect(hoursRepeatAppliesOn(lastMonday, '2026-11-23')).toBe(false)
        expect(hoursRepeatAppliesOn(lastMonday, '2026-11-30')).toBe(true)
        // December 2026 has four: the 28th is the last.
        expect(hoursRepeatAppliesOn(lastMonday, '2026-12-28')).toBe(true)
        // February 2027 has 28 days.
        expect(hoursRepeatAppliesOn(lastMonday, '2027-02-22')).toBe(true)
        expect(hoursRepeatAppliesOn(lastMonday, '2027-02-15')).toBe(false)
    })

    it('keeps to the first and last day', () => {
        const bounded = { recurrence: HoursRecurrence.Weekly, startsOn: '2026-11-09', endsOn: '2026-11-23' }
        expect(hoursRepeatAppliesOn(bounded, '2026-11-02')).toBe(false)
        expect(hoursRepeatAppliesOn(bounded, '2026-11-09')).toBe(true)
        expect(hoursRepeatAppliesOn(bounded, '2026-11-23')).toBe(true)
        expect(hoursRepeatAppliesOn(bounded, '2026-11-30')).toBe(false)
    })
})

describe('cleanHoursRepeat', () => {
    it('treats a missing rule as every week', () => {
        expect(cleanHoursRepeat(null, 1)?.recurrence).toBe(HoursRecurrence.Weekly)
    })

    it('drops the fields a rule does not use', () => {
        expect(cleanHoursRepeat({
            recurrence: HoursRecurrence.MonthlyNth,
            weekOfMonth: 2,
            intervalWeeks: 3,
            anchorDate: '2026-11-02'
        }, 1)).toEqual({
            recurrence: HoursRecurrence.MonthlyNth,
            intervalWeeks: null,
            anchorDate: null,
            weekOfMonth: 2,
            startsOn: null,
            endsOn: null
        })
    })

    it('refuses an anchor on another weekday', () => {
        expect(cleanHoursRepeat(everyOtherMonday, 1)).toBeDefined()
        expect(cleanHoursRepeat(everyOtherMonday, 2)).toBeUndefined()
    })

    it('refuses an interval out of range, a bad week of the month, or a bad date', () => {
        expect(cleanHoursRepeat({ ...everyOtherMonday, intervalWeeks: 1 }, 1)).toBeUndefined()
        expect(cleanHoursRepeat({ ...everyOtherMonday, intervalWeeks: 13 }, 1)).toBeUndefined()
        expect(cleanHoursRepeat({ recurrence: HoursRecurrence.MonthlyNth, weekOfMonth: 5 }, 1)).toBeUndefined()
        expect(cleanHoursRepeat({ recurrence: HoursRecurrence.Weekly, startsOn: '2026-02-30' }, 1)).toBeUndefined()
    })

    it('refuses a last day before the first day', () => {
        expect(cleanHoursRepeat({
            recurrence: HoursRecurrence.Weekly,
            startsOn: '2026-12-01',
            endsOn: '2026-11-30'
        }, 1)).toBeUndefined()
    })
})

describe('hoursRepeatKey', () => {
    it('reads a missing rule the same as every week', () => {
        expect(hoursRepeatKey(undefined)).toBe(hoursRepeatKey({ recurrence: HoursRecurrence.Weekly }))
        expect(hoursRepeatKey(everyOtherMonday)).not.toBe(hoursRepeatKey(undefined))
    })
})

describe('isDateKey', () => {
    it('accepts only real days', () => {
        expect(isDateKey('2028-02-29')).toBe(true)
        expect(isDateKey('2027-02-29')).toBe(false)
        expect(isDateKey('2026-1-02')).toBe(false)
    })
})
