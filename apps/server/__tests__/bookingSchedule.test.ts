import { describe, expect, it } from 'vitest'
import {
    availableStarts,
    appointmentEndFromStart,
    assertAvailabilityRange,
    isAlignedToMinutes,
    snapDownToAvailability,
    snapUpToAvailability
} from '../src/booking/schedule.js'
import {
    IDENTITY_DOCUMENT_RETENTION_DAYS,
    retainUntilFromNow,
    BOOKING_FIELD_SENSITIVITY
} from '../src/booking/retention.js'

describe('booking schedule', () => {
    it('snaps availability to 30-minute boundaries', () => {
        const odd = new Date('2026-11-05T01:07:00.000Z')
        expect(snapDownToAvailability(odd).toISOString()).toBe('2026-11-05T01:00:00.000Z')
        expect(snapUpToAvailability(odd).toISOString()).toBe('2026-11-05T01:30:00.000Z')
    })

    it('rejects availability that is not 30-minute aligned', () => {
        expect(() => assertAvailabilityRange(
            new Date('2026-11-05T01:00:00.000Z'),
            new Date('2026-11-05T01:15:00.000Z')
        )).toThrow()
    })

    it('offers 15-minute starts inside a 30-minute window for a 30-minute visit', () => {
        const starts = availableStarts({
            windows: [{
                startsAt: new Date('2026-11-05T01:00:00.000Z'),
                endsAt: new Date('2026-11-05T02:00:00.000Z')
            }],
            booked: [],
            rangeStart: new Date('2026-11-05T00:00:00.000Z'),
            rangeEnd: new Date('2026-11-05T03:00:00.000Z')
        })
        expect(starts.map(start => start.toISOString())).toEqual([
            '2026-11-05T01:00:00.000Z',
            '2026-11-05T01:15:00.000Z',
            '2026-11-05T01:30:00.000Z'
        ])
        expect(isAlignedToMinutes(starts[0]!, 15)).toBe(true)
        expect(appointmentEndFromStart(starts[0]!).toISOString()).toBe('2026-11-05T01:30:00.000Z')
    })

    it('skips starts that overlap a booked appointment', () => {
        const starts = availableStarts({
            windows: [{
                startsAt: new Date('2026-11-05T01:00:00.000Z'),
                endsAt: new Date('2026-11-05T02:00:00.000Z')
            }],
            booked: [{
                startsAt: new Date('2026-11-05T01:00:00.000Z'),
                endsAt: new Date('2026-11-05T01:30:00.000Z')
            }],
            rangeStart: new Date('2026-11-05T00:00:00.000Z'),
            rangeEnd: new Date('2026-11-05T03:00:00.000Z')
        })
        expect(starts.map(start => start.toISOString())).toEqual([
            '2026-11-05T01:30:00.000Z'
        ])
    })
})

describe('booking retention', () => {
    it('keeps identity documents for the default number of days', () => {
        const from = new Date('2026-11-01T00:00:00.000Z')
        const until = retainUntilFromNow(BOOKING_FIELD_SENSITIVITY.IDENTITY_DOCUMENT, from)
        const days = (until.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
        expect(days).toBe(IDENTITY_DOCUMENT_RETENTION_DAYS)
    })
})
