import { expect } from 'chai'
import { clinicLabel, hasClinicLabel, isClinicWritten } from '@/utils/booking/clinicLabels'

describe('clinic-written booking labels', () => {
    const labels = [
        { locale: 'en-US', text: 'Allergies' },
        { locale: 'ja-JP', text: 'アレルギー' }
    ]

    it('shows the label in the reader\'s locale', () => {
        expect(clinicLabel(labels, 'ja-JP')).to.equal('アレルギー')
        expect(hasClinicLabel(labels, 'ja-JP')).to.equal(true)
    })

    it('shows English when the clinic did not write that locale', () => {
        expect(clinicLabel(labels, 'ko-KR')).to.equal('Allergies')
        expect(hasClinicLabel(labels, 'ko-KR')).to.equal(false)
    })

    it('treats a field without labels as a Find a Doc field', () => {
        expect(isClinicWritten([])).to.equal(false)
        expect(isClinicWritten(null)).to.equal(false)
        expect(isClinicWritten(labels)).to.equal(true)
    })
})
