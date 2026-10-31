import { expect } from 'chai'
import { Locale, type BookingPractitioner } from '@findadoc/graphql'
import { interpretationCovers, practitionersForLanguages } from '@/utils/booking/practitioners'

const doctor = (id: string, spokenLanguages: Locale[]): BookingPractitioner => ({
    id, names: [], spokenLanguages, specialties: [], hasOwnSchedule: true
})

describe('booking doctor choice by language (#205)', () => {
    const doctors = [doctor('ja', [Locale.JaJp]), doctor('ne', [Locale.NeNp, Locale.JaJp])]
    const clinicLanguages = [Locale.JaJp, Locale.NeNp]

    it('lists only doctors who speak every chosen language without interpretation', () => {
        const interpreted = interpretationCovers(false, clinicLanguages, [Locale.NeNp])
        expect(interpreted).to.equal(false)
        expect(practitionersForLanguages(doctors, [Locale.NeNp], interpreted).map(item => item.id))
            .to.deep.equal(['ne'])
    })

    it('lists every doctor for a clinic language when the clinic offers interpretation', () => {
        const interpreted = interpretationCovers(true, clinicLanguages, [Locale.NeNp])
        expect(interpreted).to.equal(true)
        expect(practitionersForLanguages(doctors, [Locale.NeNp], interpreted).map(item => item.id))
            .to.deep.equal(['ja', 'ne'])
    })

    it('still narrows for a language the clinic does not list', () => {
        const interpreted = interpretationCovers(true, clinicLanguages, [Locale.NeNp, Locale.KoKr])
        expect(interpreted).to.equal(false)
        expect(practitionersForLanguages(doctors, [Locale.NeNp, Locale.KoKr], interpreted)).to.deep.equal([])
    })
})
