import { describe, expect, it } from 'vitest'
import { Locale, type BookingPractitioner } from '@findadoc/graphql'
import {
    clinicLanguages,
    coveringInterpreters,
    interpreterCoverage,
    languageGap,
    parseRequestedLanguages,
    scheduleLanes
} from '../src/booking/practitioners.js'
import { interpreterStarts } from '../src/booking/interpretation.js'
import { DEFAULT_BOOKING_FORM_ID, staffAnswers } from '../src/booking/formDefinitions.js'
import { contentDisposition } from '../src/storage/objectStorage.js'
import {
    availableStarts,
    appointmentEndFromStart,
    assertAvailabilityRange,
    expandWeeklyHours,
    isAlignedToMinutes,
    isWeeklyHours,
    normalizeWeeklyHours,
    resolveAppointmentDuration,
    resolveDefaultDuration,
    slotStepMinutes,
    subtractWindows,
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

    it('steps by 30 unless the clinic offers a 15- or 45-minute visit', () => {
        expect(slotStepMinutes([30, 60])).toBe(30)
        expect(slotStepMinutes([60])).toBe(30)
        expect(slotStepMinutes([30])).toBe(30)
        expect(slotStepMinutes([15, 30, 45, 60])).toBe(15)
        expect(slotStepMinutes([30, 45])).toBe(15)
        expect(slotStepMinutes([45])).toBe(15)
        expect(slotStepMinutes([15])).toBe(15)
        expect(slotStepMinutes([])).toBe(15)
    })

    it('offers only half-hour starts from the doctor\'s start time when the clinic has no 15 or 45', () => {
        // 09:00 to 12:00 in Japan.
        const window = { startsAt: new Date('2026-11-05T00:00:00.000Z'), endsAt: new Date('2026-11-05T03:00:00.000Z') }
        const starts = availableStarts({
            windows: [window],
            booked: [],
            rangeStart: new Date('2026-11-04T23:00:00.000Z'),
            rangeEnd: new Date('2026-11-05T04:00:00.000Z'),
            durationMs: 30 * 60 * 1000,
            stepMinutes: slotStepMinutes([30, 60])
        })
        expect(starts.map(start => start.toISOString())).toEqual([
            '2026-11-05T00:00:00.000Z',
            '2026-11-05T00:30:00.000Z',
            '2026-11-05T01:00:00.000Z',
            '2026-11-05T01:30:00.000Z',
            '2026-11-05T02:00:00.000Z',
            '2026-11-05T02:30:00.000Z'
        ])
    })

    it('keeps the half-hour grid when the range starts mid-window or an older 15-minute visit is booked', () => {
        const window = { startsAt: new Date('2026-11-05T00:00:00.000Z'), endsAt: new Date('2026-11-05T02:00:00.000Z') }
        const starts = availableStarts({
            windows: [window],
            // Booked while the clinic still offered 15 minutes: 09:00 to 09:15.
            booked: [{ startsAt: new Date('2026-11-05T00:00:00.000Z'), endsAt: new Date('2026-11-05T00:15:00.000Z') }],
            // The page asked from 09:10.
            rangeStart: new Date('2026-11-05T00:10:00.000Z'),
            rangeEnd: new Date('2026-11-05T03:00:00.000Z'),
            durationMs: 60 * 60 * 1000,
            stepMinutes: 30
        })
        expect(starts.map(start => start.toISOString())).toEqual([
            '2026-11-05T00:30:00.000Z',
            '2026-11-05T01:00:00.000Z'
        ])
    })

    it('fits a 60-minute visit into a two-hour window', () => {
        const starts = availableStarts({
            windows: [{
                startsAt: new Date('2026-11-05T01:00:00.000Z'),
                endsAt: new Date('2026-11-05T03:00:00.000Z')
            }],
            booked: [],
            rangeStart: new Date('2026-11-05T00:00:00.000Z'),
            rangeEnd: new Date('2026-11-05T04:00:00.000Z'),
            durationMs: 60 * 60 * 1000
        })
        expect(starts.map(start => start.toISOString())).toEqual([
            '2026-11-05T01:00:00.000Z',
            '2026-11-05T01:15:00.000Z',
            '2026-11-05T01:30:00.000Z',
            '2026-11-05T01:45:00.000Z',
            '2026-11-05T02:00:00.000Z'
        ])
        expect(appointmentEndFromStart(starts[0]!, 60).toISOString()).toBe('2026-11-05T02:00:00.000Z')
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

    it('preselects the clinic default length, else 30 minutes, else the shortest', () => {
        expect(resolveDefaultDuration([15, 30, 45, 60], 45)).toBe(45)
        expect(resolveDefaultDuration([15, 30, 45, 60], null)).toBe(30)
        expect(resolveDefaultDuration([15, 30], 60)).toBe(30)
        expect(resolveDefaultDuration([45, 60])).toBe(45)
        expect(resolveAppointmentDuration(null, [15, 30, 45, 60], 60)).toBe(60)
        expect(resolveAppointmentDuration(15, [15, 30, 45, 60], 60)).toBe(15)
    })
})

describe('weekly hours', () => {
    // Thursday 5 November 2026 in Japan.
    const thursdayJst = { from: new Date('2026-11-04T15:00:00.000Z'), to: new Date('2026-11-05T15:00:00.000Z') }

    it('expands a weekday block into Japan time', () => {
        const windows = expandWeeklyHours(
            [{ weekday: 4, startMinute: 9 * 60, endMinute: 12 * 60 }, { weekday: 5, startMinute: 0, endMinute: 60 }],
            thursdayJst.from,
            thursdayJst.to
        )
        expect(windows.map(window => [window.startsAt.toISOString(), window.endsAt.toISOString()])).toEqual([
            ['2026-11-05T00:00:00.000Z', '2026-11-05T03:00:00.000Z']
        ])
    })

    it('clips a block to the range and reaches back to the JST day that holds the start', () => {
        const windows = expandWeeklyHours(
            [{ weekday: 4, startMinute: 9 * 60, endMinute: 12 * 60 }],
            new Date('2026-11-05T01:00:00.000Z'),
            new Date('2026-11-05T02:00:00.000Z')
        )
        expect(windows.map(window => [window.startsAt.toISOString(), window.endsAt.toISOString()])).toEqual([
            ['2026-11-05T01:00:00.000Z', '2026-11-05T02:00:00.000Z']
        ])
    })

    it('rejects blocks that are not 30-minute aligned or end after midnight', () => {
        expect(isWeeklyHours({ weekday: 1, startMinute: 540, endMinute: 720 })).toBe(true)
        expect(isWeeklyHours({ weekday: 0, startMinute: 540, endMinute: 720 })).toBe(false)
        expect(isWeeklyHours({ weekday: 1, startMinute: 545, endMinute: 720 })).toBe(false)
        expect(isWeeklyHours({ weekday: 1, startMinute: 1380, endMinute: 1470 })).toBe(false)
        expect(isWeeklyHours({ weekday: 1, startMinute: 720, endMinute: 720 })).toBe(false)
    })

    it('joins blocks on one day that overlap or touch', () => {
        expect(normalizeWeeklyHours([
            { weekday: 2, startMinute: 780, endMinute: 1020 },
            { weekday: 1, startMinute: 600, endMinute: 720 },
            { weekday: 1, startMinute: 540, endMinute: 600 }
        ])).toEqual([
            { weekday: 1, startMinute: 540, endMinute: 720 },
            { weekday: 2, startMinute: 780, endMinute: 1020 }
        ])
    })

    it('subtracts a closure from the middle of a window', () => {
        const open = subtractWindows(
            [{ startsAt: new Date('2026-11-05T00:00:00.000Z'), endsAt: new Date('2026-11-05T03:00:00.000Z') }],
            [{ startsAt: new Date('2026-11-05T01:00:00.000Z'), endsAt: new Date('2026-11-05T01:30:00.000Z') }]
        )
        expect(open.map(window => [window.startsAt.toISOString(), window.endsAt.toISOString()])).toEqual([
            ['2026-11-05T00:00:00.000Z', '2026-11-05T01:00:00.000Z'],
            ['2026-11-05T01:30:00.000Z', '2026-11-05T03:00:00.000Z']
        ])
    })

    it('offers no start that would overlap a closure', () => {
        const starts = availableStarts({
            windows: [{ startsAt: new Date('2026-11-05T00:00:00.000Z'), endsAt: new Date('2026-11-05T02:00:00.000Z') }],
            booked: [],
            closed: [{ startsAt: new Date('2026-11-05T01:00:00.000Z'), endsAt: new Date('2026-11-05T02:00:00.000Z') }],
            rangeStart: new Date('2026-11-05T00:00:00.000Z'),
            rangeEnd: new Date('2026-11-05T03:00:00.000Z')
        })
        expect(starts.map(start => start.toISOString())).toEqual([
            '2026-11-05T00:00:00.000Z',
            '2026-11-05T00:15:00.000Z',
            '2026-11-05T00:30:00.000Z'
        ])
    })
})

describe('schedule lanes', () => {
    const doctor = (id: string, spokenLanguages: Locale[], hasOwnSchedule: boolean): BookingPractitioner => ({
        id, names: [], spokenLanguages, specialties: [], hasOwnSchedule
    })
    const practitioners = [
        doctor('a', [Locale.EnUs, Locale.JaJp], true),
        doctor('b', [Locale.JaJp], true),
        doctor('c', [Locale.KoKr], false)
    ]

    // Every case before the interpretation block is a clinic without it: no lane holds an interpreter.
    const lanes = (input: Omit<Parameters<typeof scheduleLanes>[0], 'interpreters'>) =>
        scheduleLanes({ ...input, interpreters: [] })?.map(lane => {
            expect(lane.interpreterId).toBeNull()
            return { practitionerId: lane.practitionerId }
        })

    it('searches every doctor schedule, then clinic time, when no one is chosen', () => {
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: null, languages: [] }))
            .toEqual([{ practitionerId: 'a' }, { practitionerId: 'b' }, { practitionerId: null }])
    })

    it('keeps only doctors who speak every requested language', () => {
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: null, languages: [Locale.EnUs] }))
            .toEqual([{ practitionerId: 'a' }])
    })

    it('keeps clinic time when the clinic or a doctor on clinic time covers the language', () => {
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: null, languages: [Locale.KoKr] }))
            .toEqual([{ practitionerId: null }])
        expect(lanes({
            practitioners, facilityLanguages: [Locale.ViVn], practitionerId: null, languages: [Locale.ViVn]
        })).toEqual([{ practitionerId: null }])
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: null, languages: [Locale.ViVn] }))
            .toEqual([])
    })

    it('books a chosen doctor on their own schedule, or on clinic time when they have none', () => {
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: 'b', languages: [] }))
            .toEqual([{ practitionerId: 'b' }])
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: 'c', languages: [] }))
            .toEqual([{ practitionerId: null }])
        expect(lanes({ practitioners, facilityLanguages: [], practitionerId: 'z', languages: [] }))
            .toBeUndefined()
    })

    describe('with interpreters (#205, docs/booking-interpretation.md)', () => {
        // The doc's example: Dr A (Japanese), Dr B (Japanese, English), a Nepali
        // interpreter, and a phone service for every clinic language.
        const clinic = [doctor('A', [Locale.JaJp], true), doctor('B', [Locale.JaJp, Locale.EnUs], true)]
        const facilityLanguages = [Locale.JaJp]
        const offered = clinicLanguages(clinic, facilityLanguages, [[Locale.NeNp], null])
        const interpreters = interpreterCoverage(
            [{ id: 'nepali', languages: [Locale.NeNp] }, { id: 'phone', languages: null }],
            offered
        )
        const plan = (languages: Locale[], practitionerId: string | null = null) =>
            scheduleLanes({ practitioners: clinic, facilityLanguages, practitionerId, languages, interpreters })
                ?.map(lane => `${lane.practitionerId ?? 'clinic'}+${lane.interpreterId ?? 'none'}`)

        it('reads an interpreter with no languages as every clinic language', () => {
            expect(offered).toEqual([Locale.JaJp, Locale.EnUs, Locale.NeNp])
            expect(interpreters[1]?.languages).toEqual(offered)
        })

        it('tries native schedules only when someone speaks the language', () => {
            expect(plan([Locale.JaJp])).toEqual(['A+none', 'B+none', 'clinic+none'])
        })

        it('tries native schedules first, then each other schedule with each interpreter who covers it', () => {
            expect(plan([Locale.EnUs])).toEqual(['B+none', 'A+phone', 'clinic+phone'])
            expect(plan([Locale.NeNp])).toEqual([
                'A+nepali', 'A+phone', 'B+nepali', 'B+phone', 'clinic+nepali', 'clinic+phone'
            ])
        })

        it('needs one interpreter to cover every language the doctor does not speak', () => {
            // A lacks English and Nepali: only the phone service covers both. B lacks Nepali only.
            expect(plan([Locale.EnUs, Locale.NeNp])).toEqual(['A+phone', 'B+nepali', 'B+phone', 'clinic+phone'])
        })

        it('offers nothing for a language no one speaks or covers', () => {
            expect(plan([Locale.KoKr])).toEqual([])
        })

        it('pairs a chosen doctor with an interpreter only when they need one', () => {
            expect(plan([Locale.NeNp], 'A')).toEqual(['A+nepali', 'A+phone'])
            expect(plan([Locale.JaJp], 'B')).toEqual(['B+none'])
            expect(plan([Locale.KoKr], 'A')).toEqual(['A+none'])
        })

        it('lists covering interpreters only for a real gap', () => {
            expect(coveringInterpreters(interpreters, []).map(item => item.id)).toEqual([])
            expect(languageGap([Locale.JaJp], [Locale.JaJp, Locale.NeNp])).toEqual([Locale.NeNp])
        })
    })

    it('accepts known languages only and lists the clinic languages once', () => {
        expect(parseRequestedLanguages(['en_US', 'en_US'])).toEqual([Locale.EnUs])
        expect(parseRequestedLanguages(['xx_XX'])).toBeUndefined()
        expect(parseRequestedLanguages(['und'])).toBeUndefined()
        expect(clinicLanguages(practitioners, [Locale.JaJp, 'und'])).toEqual([Locale.JaJp, Locale.EnUs, Locale.KoKr])
    })
})

describe('staff view of a request', () => {
    it('lists the full name first, then the form order, without file answers', () => {
        const answers = staffAnswers(DEFAULT_BOOKING_FORM_ID, {
            reason: 'Checkup',
            email: 'a@example.com',
            insuranceDocument: 'upload-1',
            fullName: 'Test Patient',
            phone: '090',
            legacyField: 'upload-2'
        }, new Set(['upload-1', 'upload-2']))
        expect(answers.map(answer => answer.fieldId)).toEqual(['fullName', 'email', 'phone', 'reason'])
    })

    it('names a download in ASCII and UTF-8', () => {
        expect(contentDisposition('attachment', 'uploads/booking/x/保険証.jpg'))
            .toBe(`attachment; filename="___.jpg"; filename*=UTF-8''${encodeURIComponent('保険証.jpg')}`)
        expect(contentDisposition('inline', 'a"b.png')).toBe('inline; filename="a_b.png"; filename*=UTF-8\'\'a%22b.png')
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

describe('interpreter starts (#205)', () => {
    // Monday 2 November 2026, 10:00, 11:00, and 13:30 JST.
    const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 2, hour - 9, minute))
    const starts = [at(10), at(11), at(13, 30)]
    const range = { rangeStart: at(0), rangeEnd: at(23) }
    const hour = 60 * 60 * 1000

    it('takes every start when the interpreter has no hours and no limit', () => {
        expect(interpreterStarts({
            starts, durationMs: hour, interpreter: { hours: [], capacity: null }, held: [], ...range
        })).toEqual(starts)
    })

    it('keeps only visits that end inside the interpreter hours', () => {
        const hours = [{ weekday: 1, startMinute: 10 * 60, endMinute: 14 * 60 }]
        // 13:30 for an hour runs to 14:30, past the interpreter's 14:00.
        expect(interpreterStarts({
            starts, durationMs: hour, interpreter: { hours, capacity: null }, held: [], ...range
        })).toEqual([at(10), at(11)])
        expect(interpreterStarts({
            starts, durationMs: hour / 2, interpreter: { hours, capacity: null }, held: [], ...range
        })).toEqual(starts)
    })

    it('refuses a start once the interpreter holds as many visits as their capacity', () => {
        const held = [{ startsAt: at(10), endsAt: at(11) }]
        expect(interpreterStarts({
            starts, durationMs: hour, interpreter: { hours: [], capacity: 1 }, held, ...range
        })).toEqual([at(11), at(13, 30)])
        expect(interpreterStarts({
            starts, durationMs: hour, interpreter: { hours: [], capacity: 2 }, held, ...range
        })).toEqual(starts)
    })
})
