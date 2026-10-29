import { expect } from 'chai'
import { Calendar, type DateSelectArg } from '@fullcalendar/core'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon3'
import { JAPAN_TIME_ZONE, formatJapanDateTime, viewerTimeLabel } from '@/utils/booking/japanTime'
import { intlLocale } from '@/utils/intlLocale'

// 09:00 on Monday 2 November 2026 in Japan is 19:00 on Sunday 1 November in New York.
const NINE_AM_JST = '2026-11-02T00:00:00.000Z'

describe('booking Japan time', () => {
    describe('staff calendar from a browser outside Japan', () => {
        const originalZone = process.env.TZ
        let calendar: Calendar | undefined
        let element: HTMLElement | undefined

        beforeEach(() => {
            process.env.TZ = 'America/New_York'
        })

        afterEach(() => {
            calendar?.destroy()
            element?.remove()
            process.env.TZ = originalZone
        })

        function renderCalendar(onSelect: (selection: DateSelectArg) => void): Calendar {
            element = document.createElement('div')
            document.body.appendChild(element)
            // The same zone setup as ClinicAvailabilityCalendar.vue.
            calendar = new Calendar(element, {
                plugins: [timeGridPlugin, interactionPlugin, luxonPlugin],
                timeZone: JAPAN_TIME_ZONE,
                initialView: 'timeGridWeek',
                initialDate: '2026-11-02',
                allDaySlot: true,
                selectable: true,
                select: onSelect,
                events: [{ id: 'window:1', start: NINE_AM_JST, end: '2026-11-02T01:00:00.000Z' }]
            })
            calendar.render()
            return calendar
        }

        it('runs with the process zone set outside Japan', () => {
            expect(new Date(NINE_AM_JST).getHours()).to.equal(19)
        })

        it('paints a 09:00 JST window as 09:00 JST', () => {
            let picked: DateSelectArg | undefined
            renderCalendar(selection => {
                picked = selection
            }).select('2026-11-02T09:00:00', '2026-11-02T10:00:00')

            expect(picked?.start.toISOString()).to.equal(NINE_AM_JST)
            expect(picked?.end.toISOString()).to.equal('2026-11-02T01:00:00.000Z')
        })

        it('shows a stored window at its JST hour', () => {
            const shown = renderCalendar(() => undefined).getEventById('window:1')
            expect(shown?.startStr).to.equal('2026-11-02T09:00:00+09:00')
        })

        it('closes a whole day as the Japan date', () => {
            let picked: DateSelectArg | undefined
            renderCalendar(selection => {
                picked = selection
            }).select({ start: '2026-11-02', end: '2026-11-03', allDay: true })

            expect(picked?.startStr.slice(0, 10)).to.equal('2026-11-02')
            expect(picked?.endStr.slice(0, 10)).to.equal('2026-11-03')
        })
    })

    describe('patient local time', () => {
        it('is hidden when the browser is on Japan time', () => {
            expect(viewerTimeLabel(NINE_AM_JST, 'en-US', 'Asia/Tokyo')).to.equal(null)
        })

        it('names the weekday when the local day differs', () => {
            expect(viewerTimeLabel(NINE_AM_JST, 'en-US', 'America/New_York')).to.equal('Sun 07:00 PM')
        })

        it('shows only the time on the same day', () => {
            expect(viewerTimeLabel(NINE_AM_JST, 'en-GB', 'Asia/Bangkok')).to.equal('07:00')
        })
    })

    it('formats an appointment as Japan time with the zone named', () => {
        expect(formatJapanDateTime(NINE_AM_JST, 'ja-JP')).to.contain('09:00').and.contain('JST')
    })

    it('turns site locale codes into Intl tags', () => {
        expect(intlLocale('ja_JP')).to.equal('ja-JP')
        expect(() => new Intl.DateTimeFormat(intlLocale('en_US'))).not.to.throw()
    })
})
