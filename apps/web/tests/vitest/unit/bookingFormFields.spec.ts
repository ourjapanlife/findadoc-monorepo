import { expect } from 'chai'
import { BookingPhoneRegion } from '@findadoc/graphql'
import { dateAnswerIsValid, fieldIsShown, japanDateYearsFromToday, phoneAnswer } from '~/utils/booking/formFields'

describe('booking form fields', () => {
    // 00:30 on 31 October in Japan, still 30 October in UTC.
    const now = new Date('2026-10-30T15:30:00Z')
    const birth = { min: -120, max: 0 }

    it('shows a conditional field only while the other answer matches', () => {
        const selfDescribed = { showWhen: { fieldId: 'gender', equals: 'selfDescribe' } }
        const gender = (value: string) => (fieldId: string) => (fieldId === 'gender' ? value : '')

        expect(fieldIsShown(selfDescribed, gender('selfDescribe'))).to.equal(true)
        expect(fieldIsShown(selfDescribed, gender('female'))).to.equal(false)
        expect(fieldIsShown({ showWhen: null }, gender(''))).to.equal(true)
    })

    it('shows a field for any value in anyOf, and never for an empty answer', () => {
        const handle = { showWhen: { fieldId: 'backupContactChannel', equals: null, anyOf: ['line', 'whatsapp', 'messenger'] } }
        const channel = (value: string) => (fieldId: string) => (fieldId === 'backupContactChannel' ? value : '')

        expect(fieldIsShown(handle, channel('line'))).to.equal(true)
        expect(fieldIsShown(handle, channel('messenger'))).to.equal(true)
        expect(fieldIsShown(handle, channel('telegram'))).to.equal(false)
        expect(fieldIsShown(handle, channel(''))).to.equal(false)
    })

    it('takes a Japanese phone only on a JP field, and sends it as 090-1234-5678', () => {
        const japan = { phoneRegion: BookingPhoneRegion.Jp }
        for (const raw of ['09012345678', '+81 90 1234 5678', '０９０－１２３４－５６７８']) {
            expect(phoneAnswer(japan, raw)).to.equal('090-1234-5678')
        }
        expect(phoneAnswer(japan, '+1 212 555 0100')).to.equal(null)
        expect(phoneAnswer({ phoneRegion: null }, '+1 212 555 0100')).to.equal('+1 212 555 0100')
        expect(phoneAnswer({ phoneRegion: null }, '090-123')).to.equal(null)
    })

    it('bounds a date input by calendar years from today in Japan', () => {
        expect(japanDateYearsFromToday(0, now)).to.equal('2026-10-31')
        expect(japanDateYearsFromToday(-120, now)).to.equal('1906-10-31')
        expect(japanDateYearsFromToday(-1, new Date('2028-02-29T03:00:00Z'))).to.equal('2027-02-28')
        expect(japanDateYearsFromToday(null, now)).to.equal(undefined)
    })

    it('accepts a real past date of birth up to exactly 120 years, and rejects the rest', () => {
        expect(dateAnswerIsValid('1990-04-15', birth, now)).to.equal(true)
        expect(dateAnswerIsValid('2026-10-31', birth, now)).to.equal(true)
        expect(dateAnswerIsValid('1906-10-31', birth, now)).to.equal(true)
        expect(dateAnswerIsValid('1906-10-30', birth, now)).to.equal(false)
        expect(dateAnswerIsValid('2026-11-01', birth, now)).to.equal(false)
        expect(dateAnswerIsValid('1990-02-30', birth, now)).to.equal(false)
        expect(dateAnswerIsValid('15/04/1990', birth, now)).to.equal(false)
    })
})
