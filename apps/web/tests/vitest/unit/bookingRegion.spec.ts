import { expect } from 'chai'
import { bookingConfirmationsComplete, bookingRefusal } from '@/utils/booking/formQuery'
import { ErrorCode } from '@/typedefs/serverResponse'

// Booking is offered only to people in Japan (#173).
describe('booking region and confirmations', () => {
    it('reads the API\'s region refusal as its own reason', () => {
        expect(bookingRefusal({
            errors: [{
                message: 'Booking is only available to people in Japan',
                code: ErrorCode.BOOKING_REGION_UNAVAILABLE,
                field: undefined
            }]
        })).to.equal('regionUnavailable')
        expect(bookingRefusal({
            errors: [{ message: 'Validation Failed', code: ErrorCode.INVALID_INPUT, field: 'email' }]
        })).to.equal('failed')
    })

    it('blocks submit until both boxes are ticked', () => {
        expect(bookingConfirmationsComplete({ confirmedInJapan: false, healthDataConsent: false })).to.equal(false)
        expect(bookingConfirmationsComplete({ confirmedInJapan: true, healthDataConsent: false })).to.equal(false)
        expect(bookingConfirmationsComplete({ confirmedInJapan: false, healthDataConsent: true })).to.equal(false)
        expect(bookingConfirmationsComplete({ confirmedInJapan: true, healthDataConsent: true })).to.equal(true)
    })
})
