import { expect } from 'chai'
import { dateAnswerIsValid, fieldIsShown, japanDateFromToday } from '~/utils/booking/formFields'

describe('booking form fields', () => {
    // 00:30 on 31 October in Japan, still 30 October in UTC.
    const now = new Date('2026-10-30T15:30:00Z')
    const birth = { min: -43829, max: 0 }

    it('shows a conditional field only while the other answer matches', () => {
        const selfDescribed = { showWhen: { fieldId: 'gender', equals: 'selfDescribe' } }
        const gender = (value: string) => (fieldId: string) => (fieldId === 'gender' ? value : '')

        expect(fieldIsShown(selfDescribed, gender('selfDescribe'))).to.equal(true)
        expect(fieldIsShown(selfDescribed, gender('female'))).to.equal(false)
        expect(fieldIsShown({ showWhen: null }, gender(''))).to.equal(true)
    })

    it('bounds a date input by days from today in Japan', () => {
        expect(japanDateFromToday(0, now)).to.equal('2026-10-31')
        expect(japanDateFromToday(-1, now)).to.equal('2026-10-30')
        expect(japanDateFromToday(null, now)).to.equal(undefined)
    })

    it('accepts a real past date of birth and rejects the rest', () => {
        expect(dateAnswerIsValid('1990-04-15', birth, now)).to.equal(true)
        expect(dateAnswerIsValid('2026-10-31', birth, now)).to.equal(true)
        expect(dateAnswerIsValid('2026-11-01', birth, now)).to.equal(false)
        expect(dateAnswerIsValid('1900-01-01', birth, now)).to.equal(false)
        expect(dateAnswerIsValid('1990-02-30', birth, now)).to.equal(false)
        expect(dateAnswerIsValid('15/04/1990', birth, now)).to.equal(false)
    })
})
