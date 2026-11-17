import { OpeningDay } from '@findadoc/graphql'
import { describe, expect, it } from 'vitest'
import {
    cleanAdditionalInfo,
    MAX_OPENING_BLOCKS,
    normalizeOpeningHours,
    openingHoursProblem,
    openingMinutes
} from './openingHours.js'

describe('openingMinutes', () => {
    it('reads a 24-hour time and the end of the day', () => {
        expect(openingMinutes('09:30')).toBe(570)
        expect(openingMinutes('24:00')).toBe(1440)
    })

    it('refuses text that is not HH:MM', () => {
        expect(openingMinutes('9:30')).toBeNull()
        expect(openingMinutes('25:00')).toBeNull()
        expect(openingMinutes('12:60')).toBeNull()
        expect(openingMinutes('noon')).toBeNull()
    })
})

describe('openingHoursProblem', () => {
    it('accepts an empty list as unknown', () => {
        expect(openingHoursProblem([])).toBeNull()
    })

    it('accepts a split day and a block that runs to midnight', () => {
        expect(openingHoursProblem([
            { day: OpeningDay.Monday, opens: '09:00', closes: '12:30' },
            { day: OpeningDay.Monday, opens: '15:00', closes: '18:00' },
            { day: OpeningDay.PublicHoliday, opens: '00:00', closes: '24:00' }
        ])).toBeNull()
    })

    it('refuses a closing time that is not after the opening time', () => {
        expect(openingHoursProblem([{ day: OpeningDay.Monday, opens: '18:00', closes: '09:00' }]))
            .toBe('closes_before_opens')
        expect(openingHoursProblem([{ day: OpeningDay.Monday, opens: '09:00', closes: '09:00' }]))
            .toBe('closes_before_opens')
    })

    it('refuses a block that opens at the end of the day', () => {
        expect(openingHoursProblem([{ day: OpeningDay.Monday, opens: '24:00', closes: '24:00' }])).toBe('bad_time')
    })

    it('refuses overlapping blocks on one day but not the same times on two days', () => {
        expect(openingHoursProblem([
            { day: OpeningDay.Tuesday, opens: '09:00', closes: '13:00' },
            { day: OpeningDay.Tuesday, opens: '12:00', closes: '18:00' }
        ])).toBe('overlap')
        expect(openingHoursProblem([
            { day: OpeningDay.Tuesday, opens: '09:00', closes: '13:00' },
            { day: OpeningDay.Wednesday, opens: '09:00', closes: '13:00' }
        ])).toBeNull()
    })

    it('refuses an unknown day, too many blocks on a day, and too many blocks', () => {
        expect(openingHoursProblem([{ day: 'FUNDAY' as OpeningDay, opens: '09:00', closes: '10:00' }]))
            .toBe('unknown_day')
        const fiveOnMonday = ['08', '10', '12', '14', '16'].map(hour => ({
            day: OpeningDay.Monday, opens: `${hour}:00`, closes: `${hour}:30`
        }))
        expect(openingHoursProblem(fiveOnMonday)).toBe('too_many_on_day')
        const tooMany = Array.from({ length: MAX_OPENING_BLOCKS + 1 }, () => (
            { day: OpeningDay.Monday, opens: '09:00', closes: '10:00' }
        ))
        expect(openingHoursProblem(tooMany)).toBe('too_many')
    })
})

describe('normalizeOpeningHours', () => {
    it('orders blocks by day then opening time, holidays last', () => {
        expect(normalizeOpeningHours([
            { day: 'PUBLIC_HOLIDAY', opens: '09:00', closes: '12:00' },
            { day: 'MONDAY', opens: '15:00', closes: '18:00' },
            { day: 'MONDAY', opens: '09:00', closes: '12:00' }
        ])).toEqual([
            { day: 'MONDAY', opens: '09:00', closes: '12:00' },
            { day: 'MONDAY', opens: '15:00', closes: '18:00' },
            { day: 'PUBLIC_HOLIDAY', opens: '09:00', closes: '12:00' }
        ])
    })

    it('reads a JSON string and drops entries it cannot show', () => {
        expect(normalizeOpeningHours(JSON.stringify([
            { day: 'FRIDAY', opens: '09:00', closes: '17:00', extra: 'dropped' },
            { day: 'FRIDAY', opens: 'late', closes: '17:00' },
            'not a block'
        ]))).toEqual([{ day: 'FRIDAY', opens: '09:00', closes: '17:00' }])
    })

    it('treats anything that is not a list as unknown', () => {
        expect(normalizeOpeningHours(null)).toEqual([])
        expect(normalizeOpeningHours('{')).toEqual([])
        expect(normalizeOpeningHours({ day: 'MONDAY' })).toEqual([])
    })
})

describe('cleanAdditionalInfo', () => {
    it('trims a note and turns blank into null', () => {
        expect(cleanAdditionalInfo('  Walk-ins welcome.  ')).toBe('Walk-ins welcome.')
        expect(cleanAdditionalInfo('   ')).toBeNull()
        expect(cleanAdditionalInfo(undefined)).toBeNull()
    })
})
