import { expect } from 'chai'
import {
    clearBookingAutofill,
    isBookingAutofillHost,
    readBookingAutofill,
    writeBookingAutofill
} from '@/utils/booking/localhostAutofill'

describe('booking localhost autofill', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('allows only localhost-style hosts', () => {
        expect(isBookingAutofillHost('localhost')).to.equal(true)
        expect(isBookingAutofillHost('127.0.0.1')).to.equal(true)
        expect(isBookingAutofillHost('multilingual-online-clinic.localhost')).to.equal(true)
        expect(isBookingAutofillHost('multilingual-online-clinic.findadoc.jp')).to.equal(false)
        expect(isBookingAutofillHost('www.findadoc.jp')).to.equal(false)
    })

    it('writes and reads a draft on localhost only', () => {
        expect(writeBookingAutofill('form-1', 1, { email: 'a@b.com' }, 'www.findadoc.jp')).to.equal(false)
        expect(readBookingAutofill('form-1', 'www.findadoc.jp')).to.equal(null)

        expect(writeBookingAutofill('form-1', 1, { email: 'a@b.com', phone: '090' }, 'clinic.localhost')).to.equal(true)
        const draft = readBookingAutofill('form-1', 'clinic.localhost')
        expect(draft?.formId).to.equal('form-1')
        expect(draft?.formVersion).to.equal(1)
        expect(draft?.values).to.deep.equal({ email: 'a@b.com', phone: '090' })
        expect(draft?.startsAt).to.equal(null)

        expect(writeBookingAutofill(
            'form-1',
            1,
            { email: 'a@b.com' },
            'clinic.localhost',
            '2026-10-28T11:30:00.000Z'
        )).to.equal(true)
        expect(readBookingAutofill('form-1', 'clinic.localhost')?.startsAt).to.equal('2026-10-28T11:30:00.000Z')

        clearBookingAutofill('form-1', 'clinic.localhost')
        expect(readBookingAutofill('form-1', 'clinic.localhost')).to.equal(null)
    })
})
