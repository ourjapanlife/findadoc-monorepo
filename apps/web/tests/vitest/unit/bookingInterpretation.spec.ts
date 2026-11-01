import { expect } from 'chai'
import { Locale, type BookingPractitioner } from '@findadoc/graphql'
import { interpreterCoversDoctor, practitionersForLanguages } from '@/utils/booking/practitioners'

const doctor = (id: string, spokenLanguages: Locale[]): BookingPractitioner => ({
    id, names: [], spokenLanguages, specialties: [], hasOwnSchedule: true
})

describe('booking doctor choice by language (#205)', () => {
    const doctors = [doctor('ja', [Locale.JaJp]), doctor('jaEn', [Locale.JaJp, Locale.EnUs])]
    const nepali = { languages: [Locale.NeNp] }
    const phone = { languages: [Locale.JaJp, Locale.EnUs, Locale.NeNp] }
    const ids = (list: BookingPractitioner[]) => list.map(item => item.id)

    it('lists only doctors who speak every chosen language when the clinic has no interpreters', () => {
        expect(ids(practitionersForLanguages(doctors, [Locale.EnUs], []))).to.deep.equal(['jaEn'])
        expect(ids(practitionersForLanguages(doctors, [Locale.NeNp], []))).to.deep.equal([])
    })

    it('lists a doctor when one interpreter covers what they do not speak', () => {
        expect(ids(practitionersForLanguages(doctors, [Locale.NeNp], [nepali]))).to.deep.equal(['ja', 'jaEn'])
        // English and Nepali: only jaEn is covered by the Nepali interpreter alone.
        expect(ids(practitionersForLanguages(doctors, [Locale.EnUs, Locale.NeNp], [nepali]))).to.deep.equal(['jaEn'])
        expect(ids(practitionersForLanguages(doctors, [Locale.EnUs, Locale.NeNp], [nepali, phone])))
            .to.deep.equal(['ja', 'jaEn'])
    })

    it('needs a real gap for an interpreter to matter', () => {
        expect(interpreterCoversDoctor([Locale.JaJp], [Locale.JaJp], [phone])).to.equal(false)
        expect(interpreterCoversDoctor([Locale.JaJp], [Locale.KoKr], [phone])).to.equal(false)
    })
})
