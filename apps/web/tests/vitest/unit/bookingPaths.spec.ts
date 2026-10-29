import { expect } from 'chai'
import { bookingClinicPath, findadocBookUrl, findadocOrigin } from '@/utils/booking/paths'
import { parseBookingQuery } from '@/utils/booking/query'
import { resolveDuration } from '@/utils/booking/durations'

describe('booking paths', () => {
    it('keeps Book on the Find a Doc origin with the facility id', () => {
        expect(bookingClinicPath('facility-1')).to.equal('/book/facility-1')
        expect(bookingClinicPath('facility-1', 'ja-JP', { duration: 30 }))
            .to.equal('/ja-JP/book/facility-1?duration=30')
        expect(findadocOrigin('multilingual-online-clinic.localhost:3000'))
            .to.equal('http://localhost:3000')
        expect(findadocOrigin('www.findadoc.jp')).to.equal('https://www.findadoc.jp')
        expect(findadocBookUrl('facility-1', {
            localeCode: 'ja-JP',
            requestHost: 'clinic.localhost:3000',
            query: { duration: 45, practitioner: 'hp-1' }
        })).to.equal('http://localhost:3000/ja-JP/book/facility-1?duration=45&practitioner=hp-1')
    })

    it('reads industry query params and ignores unknown durations', () => {
        expect(parseBookingQuery({
            duration: '30',
            start: '2026-11-05T01:00:00.000Z',
            practitioner: 'hp-1',
            form: 'findadoc-intake-v1',
            service: 'consult'
        })).to.deep.equal({
            duration: 30,
            start: '2026-11-05T01:00:00.000Z',
            practitioner: 'hp-1',
            form: 'findadoc-intake-v1',
            service: 'consult'
        })
        expect(parseBookingQuery({ duration: '20' }).duration).to.equal(undefined)
        expect(resolveDuration(45, [15, 30, 45, 60])).to.equal(45)
        expect(resolveDuration(20, [15, 45])).to.equal(15)
    })
})
