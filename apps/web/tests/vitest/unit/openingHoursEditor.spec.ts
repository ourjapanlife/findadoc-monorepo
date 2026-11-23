import { describe, expect, it } from 'vitest'
import { OpeningDay, type OpeningHours } from '@findadoc/graphql'
import {
    addBreak,
    breaksForDay,
    closingTimeOptions,
    copyMondayToWeekdays,
    openingTimeOptions
} from '~/utils/openingHoursEditor'

const MONDAY = OpeningDay.Monday

describe('the time lists', () => {
    it('offer five-minute steps, and close only after the block opens, up to 24:00', () => {
        expect(openingTimeOptions('09:00')).toContain('08:50')
        expect(openingTimeOptions('09:00').at(-1)).toBe('23:55')
        const closes = closingTimeOptions('12:00', '18:00')
        expect(closes).toContain('12:10')
        expect(closes[0]).toBe('12:05')
        expect(closes.at(-1)).toBe('24:00')
    })

    it('keep a saved time that is off the step', () => {
        expect(openingTimeOptions('08:52')).toContain('08:52')
        expect(closingTimeOptions('08:52', '12:13')).toContain('12:13')
    })
})

describe('addBreak', () => {
    it('splits a day that spans lunch at 12:00–13:00', () => {
        expect(addBreak([{ day: MONDAY, opens: '09:00', closes: '18:30' }], MONDAY)).toEqual([
            { day: MONDAY, opens: '09:00', closes: '12:00' },
            { day: MONDAY, opens: '13:00', closes: '18:30' }
        ])
    })

    it('adds a block an hour after a morning-only day closes', () => {
        expect(addBreak([{ day: MONDAY, opens: '09:00', closes: '12:00' }], MONDAY)).toEqual([
            { day: MONDAY, opens: '09:00', closes: '12:00' },
            { day: MONDAY, opens: '13:00', closes: '16:00' }
        ])
    })

    it('splits an evening block that runs to 24:00 in its middle instead of overlapping it', () => {
        expect(addBreak([{ day: MONDAY, opens: '18:00', closes: '24:00' }], MONDAY)).toEqual([
            { day: MONDAY, opens: '18:00', closes: '20:30' },
            { day: MONDAY, opens: '21:30', closes: '24:00' }
        ])
    })

    it('keeps a late block too short to split as it is', () => {
        const late: OpeningHours[] = [{ day: MONDAY, opens: '23:00', closes: '24:00' }]
        expect(addBreak(late, MONDAY)).toEqual(late)
    })

    it('stops at four blocks a day', () => {
        const four: OpeningHours[] = ['08:00', '10:00', '13:00', '17:00'].map(opens => ({
            day: MONDAY, opens, closes: opens.replace(/^(\d\d)/, hour => String(Number(hour) + 1).padStart(2, '0'))
        }))
        expect(addBreak(four, MONDAY)).toHaveLength(4)
    })
})

describe('breaksForDay', () => {
    it('names the gap between blocks, and nothing where blocks touch', () => {
        expect(breaksForDay([
            { day: MONDAY, opens: '16:30', closes: '18:30' },
            { day: MONDAY, opens: '09:00', closes: '12:00' },
            { day: MONDAY, opens: '18:30', closes: '20:00' }
        ], MONDAY)).toEqual([{ from: '12:00', to: '16:30' }, null])
    })
})

describe('copyMondayToWeekdays', () => {
    it('replaces Tuesday to Friday with Monday and leaves the weekend', () => {
        const copied = copyMondayToWeekdays([
            { day: MONDAY, opens: '09:00', closes: '12:00' },
            { day: OpeningDay.Wednesday, opens: '10:00', closes: '11:00' },
            { day: OpeningDay.Sunday, opens: '10:00', closes: '11:00' }
        ])
        expect(copied.filter(block => block.day === OpeningDay.Wednesday))
            .toEqual([{ day: OpeningDay.Wednesday, opens: '09:00', closes: '12:00' }])
        expect(copied.filter(block => block.day === OpeningDay.Sunday)).toHaveLength(1)
        expect(copied).toHaveLength(6)
    })
})
