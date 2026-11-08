import { expect } from 'chai'
import { HoursRecurrence } from '@findadoc/graphql'
import { expandWeeklyHours } from '@/utils/booking/japanTime'
import {
    anchorOptions,
    blocksOverlap,
    newBlock,
    repeatChoice,
    repeatFromChoice,
    repeatOnWeekday,
    scheduleHoursInput,
    upcomingAnchor
} from '@/utils/booking/weeklyHoursBlocks'

// Sunday 8 November 2026 in Japan.
const TODAY = '2026-11-08'

describe('weekly hours repeat (#203)', () => {
    it('shows a block on the calendar only on the weeks it repeats', () => {
        const block = {
            weekday: 1,
            startMinute: 9 * 60,
            endMinute: 12 * 60,
            repeat: { recurrence: HoursRecurrence.Interval, intervalWeeks: 2, anchorDate: '2026-11-09' }
        }
        const days = expandWeeklyHours([block], '2026-11-01T15:00:00.000Z', '2026-11-30T15:00:00.000Z')
            .map(range => new Date(Date.parse(range.startsAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10))
        expect(days).to.deep.equal(['2026-11-09', '2026-11-23'])
    })

    it('offers one first day per week of the rhythm, from this week', () => {
        expect(anchorOptions(1, 2, TODAY)).to.deep.equal(['2026-11-09', '2026-11-16'])
        expect(anchorOptions(7, 3, TODAY)).to.deep.equal(['2026-11-08', '2026-11-15', '2026-11-22'])
    })

    it('moves a past first day forward in the same rhythm', () => {
        expect(upcomingAnchor('2026-10-12', 2, TODAY)).to.equal('2026-11-09')
        expect(upcomingAnchor('2026-11-16', 2, TODAY)).to.equal('2026-11-16')
    })

    it('turns a picker choice into a repeat and back, keeping the first and last day', () => {
        const block = newBlock(1, 540, 720)
        block.repeat.endsOn = '2027-03-31'
        const every2 = repeatFromChoice('interval:2', block, TODAY)
        expect(every2).to.include({
            recurrence: HoursRecurrence.Interval,
            intervalWeeks: 2,
            anchorDate: '2026-11-09',
            endsOn: '2027-03-31'
        })
        expect(repeatChoice(every2)).to.equal('interval:2')
        const lastMonday = repeatFromChoice('monthly:-1', block, TODAY)
        expect(lastMonday).to.include({ recurrence: HoursRecurrence.MonthlyNth, weekOfMonth: -1, anchorDate: null })
        expect(repeatChoice(repeatFromChoice('weekly', block, TODAY))).to.equal('weekly')
    })

    it('moves the first day to the same week when Monday is copied to Wednesday', () => {
        const repeat = repeatFromChoice('interval:2', newBlock(1, 540, 720), TODAY)
        expect(repeatOnWeekday(repeat, 1, 3).anchorDate).to.equal('2026-11-11')
    })

    it('allows blocks on one day to overlap only when they repeat differently', () => {
        const firstMonday = repeatFromChoice('monthly:1', newBlock(1, 540, 720), TODAY)
        expect(blocksOverlap([newBlock(1, 540, 720), newBlock(1, 600, 780, firstMonday)])).to.equal(false)
        expect(blocksOverlap([newBlock(1, 540, 720), newBlock(1, 600, 780)])).to.equal(true)
    })

    it('sends each block with its repeat', () => {
        const [input] = scheduleHoursInput([newBlock(2, 540, 720)])
        expect(input?.repeat.recurrence).to.equal(HoursRecurrence.Weekly)
    })
})
