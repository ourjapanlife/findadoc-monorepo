/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { BookingAppointmentStatus } from '@findadoc/graphql'
import { answersRemovedNoteKey } from '@/utils/booking/appointmentStatus'

const PURGED_AT = '2026-11-08T00:00:00.000Z'

describe('answersRemovedNoteKey (#212)', () => {
    it('shows no note while the answers are kept', () => {
        expect(answersRemovedNoteKey({ answersPurgedAt: null, appointmentStatus: BookingAppointmentStatus.Completed }))
            .to.equal(null)
        expect(answersRemovedNoteKey(null)).to.equal(null)
    })

    it('says the answers went after the retention period for a past visit', () => {
        expect(answersRemovedNoteKey({
            answersPurgedAt: PURGED_AT,
            appointmentStatus: BookingAppointmentStatus.Completed
        })).to.equal('bookingDashboard.answersRemoved')
        expect(answersRemovedNoteKey({ answersPurgedAt: PURGED_AT, appointmentStatus: null }))
            .to.equal('bookingDashboard.answersRemoved')
    })

    it('says the answers went at the cancel or decline', () => {
        for (const status of [BookingAppointmentStatus.Cancelled, BookingAppointmentStatus.Declined]) {
            expect(answersRemovedNoteKey({ answersPurgedAt: PURGED_AT, appointmentStatus: status }))
                .to.equal('bookingDashboard.answersRemovedOnClose')
        }
    })
})
