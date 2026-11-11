/// <reference types="vitest/globals" />
import { expect } from 'chai'
import {
    CorrectionReporterRelation,
    FacilityCorrectionReason,
    FacilityVerificationStatus,
    Locale,
    PaymentType
} from '@findadoc/graphql'
import { FIELD_LIMITS } from '@findadoc/utils'
import {
    addressWithPrefecture,
    correctionDraftErrors,
    correctionDraftFromBaseline,
    correctionInputFromDraft,
    correctionLanguageOptions,
    correctionPromptVariant,
    correctionRefusal,
    isUntouchedDraft,
    isValidCorrectionWebsite,
    isValidListingUrl,
    toggleCorrectionReason,
    visibleCorrectionFields,
    type CorrectionBaseline
} from '@/utils/facilityCorrection'
import { correctionSubmittedProps } from '@/utils/analyticsEvents'
import { ErrorCode } from '@/typedefs/serverResponse'

// Fake clinic only.
const BASELINE: CorrectionBaseline = {
    id: '6f1c2a5e-4b3d-4c2a-9e1f-0a1b2c3d4e5f',
    contact: {
        email: 'front-desk@example.com',
        phone: '03-5555-0100',
        website: 'https://example-clinic.test',
        googleMapsUrl: 'https://maps.google.com/?q=35.66,139.73',
        address: {
            postalCode: '106-0032',
            prefectureEn: 'Tokyo',
            cityEn: 'Minato',
            addressLine1En: '1-2-3 Roppongi',
            addressLine2En: 'Example Building 4F',
            prefectureJa: '東京都',
            cityJa: '港区',
            addressLine1Ja: '六本木1-2-3',
            addressLine2Ja: 'サンプルビル4階'
        }
    },
    supportedLanguages: [Locale.EnUs, Locale.JaJp],
    paymentOptions: [
        { paymentType: PaymentType.Cash, paymentBrands: [] },
        { paymentType: PaymentType.CreditCard, paymentBrands: ['VISA'] }
    ]
}

function draftWith(reasons: FacilityCorrectionReason[]) {
    return { ...correctionDraftFromBaseline(BASELINE), reasons }
}

describe('clinic correction form', () => {
    it('shows the louder confirm card for any listing a moderator has not confirmed', () => {
        expect(correctionPromptVariant(FacilityVerificationStatus.Confirmed)).to.equal('error')
        expect(correctionPromptVariant(FacilityVerificationStatus.Unverified)).to.equal('confirm')
        expect(correctionPromptVariant(null)).to.equal('confirm')
    })

    it('pre-fills the draft with what the page shows', () => {
        const draft = correctionDraftFromBaseline(BASELINE)

        expect(draft.reasons).to.deep.equal([])
        expect(draft.phone).to.equal('03-5555-0100')
        expect(draft.website).to.equal('https://example-clinic.test')
        expect(draft.address.cityEn).to.equal('Minato')
        expect(draft.address.cityJa).to.equal('港区')
        expect(draft.supportedLanguages).to.deep.equal([Locale.EnUs, Locale.JaJp])
        expect(draft.paymentTypes).to.deep.equal([PaymentType.Cash, PaymentType.CreditCard])
    })

    it('pre-fills empty lists for a clinic with no languages or payment options stored', () => {
        const draft = correctionDraftFromBaseline({
            id: BASELINE.id,
            contact: { ...BASELINE.contact, phone: '', website: null },
            supportedLanguages: [],
            paymentOptions: []
        })

        expect(draft.phone).to.equal('')
        expect(draft.website).to.equal('')
        expect(draft.supportedLanguages).to.deep.equal([])
        expect(draft.paymentTypes).to.deep.equal([])
    })

    it('shows one field per picked reason, and none for closed or something else', () => {
        expect(visibleCorrectionFields([])).to.deep.equal([])
        expect(visibleCorrectionFields([FacilityCorrectionReason.Closed, FacilityCorrectionReason.Other]))
            .to.deep.equal([])
        expect(visibleCorrectionFields([FacilityCorrectionReason.WrongLanguages])).to.deep.equal(['languages'])
        expect(visibleCorrectionFields([
            FacilityCorrectionReason.Duplicate,
            FacilityCorrectionReason.WrongContact,
            FacilityCorrectionReason.WrongCity
        ])).to.deep.equal(['address', 'contact', 'duplicate'])
    })

    it('treats a draft as untouched only until the visitor types or picks anything', () => {
        const draft = correctionDraftFromBaseline(BASELINE)

        expect(isUntouchedDraft(draft, BASELINE)).to.equal(true)
        // A note typed before any reason is picked must survive the live values arriving.
        expect(isUntouchedDraft({ ...draft, notes: 'Closed on Wednesdays' }, BASELINE)).to.equal(false)
        expect(isUntouchedDraft({ ...draft, reporterRelation: CorrectionReporterRelation.Patient }, BASELINE))
            .to.equal(false)
        expect(isUntouchedDraft({ ...draft, phone: '03-5555-0199' }, BASELINE)).to.equal(false)
    })

    it('uses the shared field limits for the website and the duplicate link', () => {
        const longWebsite = `https://clinic.example.com/${'a'.repeat(FIELD_LIMITS.website)}`
        const longListing = `https://findadoc.jp/clinic/${'a'.repeat(FIELD_LIMITS.listingUrl)}`

        expect(isValidCorrectionWebsite(longWebsite)).to.equal(false)
        expect(isValidListingUrl(longListing)).to.equal(false)
    })

    it('toggles a reason and keeps the form order', () => {
        const picked = toggleCorrectionReason(
            toggleCorrectionReason([], FacilityCorrectionReason.Other),
            FacilityCorrectionReason.WrongCity
        )
        expect(picked).to.deep.equal([FacilityCorrectionReason.WrongCity, FacilityCorrectionReason.Other])
        expect(toggleCorrectionReason(picked, FacilityCorrectionReason.WrongCity))
            .to.deep.equal([FacilityCorrectionReason.Other])
    })

    it('sends the reasons alone when nothing was changed', () => {
        const input = correctionInputFromDraft(
            draftWith([FacilityCorrectionReason.WrongContact, FacilityCorrectionReason.Closed]),
            BASELINE
        )

        expect(input).to.deep.equal({
            facilityId: BASELINE.id,
            reasons: [FacilityCorrectionReason.WrongContact, FacilityCorrectionReason.Closed]
        })
    })

    it('sends only the changed field of a picked reason', () => {
        const draft = {
            ...draftWith([FacilityCorrectionReason.WrongContact]),
            phone: ' 03-5555-0142 ',
            website: 'https://example-clinic.test'
        }

        const input = correctionInputFromDraft(draft, BASELINE)

        expect(input.phone).to.equal('03-5555-0142')
        expect(input).not.to.have.property('website')
        expect(input).not.to.have.property('address')
    })

    it('leaves out a changed field whose reason was unpicked', () => {
        const draft = {
            ...draftWith([FacilityCorrectionReason.WrongPayment]),
            phone: '03-5555-0142',
            supportedLanguages: [Locale.EnUs]
        }

        const input = correctionInputFromDraft(draft, BASELINE)

        expect(input).not.to.have.property('phone')
        expect(input).not.to.have.property('supportedLanguages')
    })

    it('sends the new language list for wrong languages', () => {
        const draft = {
            ...draftWith([FacilityCorrectionReason.WrongLanguages]),
            supportedLanguages: [Locale.EnUs, Locale.JaJp, Locale.ZhCn]
        }

        expect(correctionInputFromDraft(draft, BASELINE).supportedLanguages)
            .to.deep.equal([Locale.EnUs, Locale.JaJp, Locale.ZhCn])
    })

    it('treats the same languages in another order as unchanged', () => {
        const draft = {
            ...draftWith([FacilityCorrectionReason.WrongLanguages]),
            supportedLanguages: [Locale.JaJp, Locale.EnUs]
        }

        expect(correctionInputFromDraft(draft, BASELINE)).not.to.have.property('supportedLanguages')
    })

    it('keeps the stored card brands on a payment type the visitor kept', () => {
        const draft = {
            ...draftWith([FacilityCorrectionReason.WrongPayment]),
            paymentTypes: [PaymentType.DebitCard, PaymentType.CreditCard]
        }

        expect(correctionInputFromDraft(draft, BASELINE).paymentOptions).to.deep.equal([
            { paymentType: PaymentType.CreditCard, paymentBrands: ['VISA'] },
            { paymentType: PaymentType.DebitCard, paymentBrands: [] }
        ])
    })

    it('sends the whole trimmed address when one part changed', () => {
        const before = correctionDraftFromBaseline(BASELINE)
        const draft = {
            ...draftWith([FacilityCorrectionReason.WrongCity]),
            address: { ...before.address, addressLine1En: ' 4-5-6 Azabu ' }
        }

        const address = correctionInputFromDraft(draft, BASELINE).address

        expect(address?.addressLine1En).to.equal('4-5-6 Azabu')
        expect(address?.cityJa).to.equal('港区')
    })

    it('sets both prefecture names from either language', () => {
        const address = correctionDraftFromBaseline(BASELINE).address

        expect(addressWithPrefecture(address, 'Osaka', false)).to.include({ prefectureEn: 'Osaka', prefectureJa: '大阪府' })
        expect(addressWithPrefecture(address, '北海道', true)).to.include({ prefectureEn: 'Hokkaido', prefectureJa: '北海道' })
    })

    it('trims the note, leaves out an empty one, and sends the relation', () => {
        const withNote = {
            ...draftWith([FacilityCorrectionReason.Other]),
            notes: '  The entrance moved to the side street.  ',
            reporterRelation: CorrectionReporterRelation.Called
        }
        const input = correctionInputFromDraft(withNote, BASELINE)
        expect(input.notes).to.equal('The entrance moved to the side street.')
        expect(input.reporterRelation).to.equal(CorrectionReporterRelation.Called)

        const blank = correctionInputFromDraft({ ...withNote, notes: '   ', reporterRelation: null }, BASELINE)
        expect(blank).not.to.have.property('notes')
        expect(blank).not.to.have.property('reporterRelation')
    })

    it('offers every language the API accepts and keeps one the clinic already lists', () => {
        const options = correctionLanguageOptions([Locale.Und])

        expect(options[0]).to.equal(Locale.EnUs)
        expect(options[1]).to.equal(Locale.JaJp)
        // Both are published but were missing from the search facet list.
        expect(options).to.include(Locale.ViVn)
        expect(options).to.include(Locale.RuRu)
        expect(options).to.include(Locale.Und)
        expect(new Set(options).size).to.equal(options.length)
    })

    it('accepts only https links to a findadoc.jp listing', () => {
        expect(isValidListingUrl('')).to.equal(true)
        expect(isValidListingUrl('https://findadoc.jp/clinic/tokyo/minato/sample--1')).to.equal(true)
        expect(isValidListingUrl('https://www.findadoc.jp/clinic/tokyo/minato/sample--1')).to.equal(true)
        expect(isValidListingUrl('http://findadoc.jp/clinic/tokyo/minato/sample--1')).to.equal(false)
        expect(isValidListingUrl('https://example.com/clinic')).to.equal(false)
        expect(isValidListingUrl('javascript:alert(1)')).to.equal(false)
    })

    it('accepts an empty website or an https one', () => {
        expect(isValidCorrectionWebsite('')).to.equal(true)
        expect(isValidCorrectionWebsite('https://example-clinic.test')).to.equal(true)
        expect(isValidCorrectionWebsite('http://example-clinic.test')).to.equal(false)
        expect(isValidCorrectionWebsite('example-clinic')).to.equal(false)
    })

    it('needs a reason, a valid changed phone, and a findadoc.jp duplicate link', () => {
        expect(correctionDraftErrors(draftWith([]), BASELINE)).to.have.property('reasons')

        const contact = { ...draftWith([FacilityCorrectionReason.WrongContact]), phone: '', website: 'http://x.test' }
        const contactErrors = correctionDraftErrors(contact, BASELINE)
        expect(contactErrors).to.have.property('phone')
        expect(contactErrors).to.have.property('website')

        const duplicate = { ...draftWith([FacilityCorrectionReason.Duplicate]), duplicateListingUrl: 'https://example.com' }
        expect(correctionDraftErrors(duplicate, BASELINE)).to.have.property('duplicateListingUrl')

        expect(correctionDraftErrors(draftWith([FacilityCorrectionReason.WrongContact]), BASELINE)).to.deep.equal({})
    })

    it('tells the visitor whether to fix the form or try later', () => {
        expect(correctionRefusal([{ code: ErrorCode.TOO_MANY_REQUESTS }])).to.equal('rateLimited')
        expect(correctionRefusal([{ code: ErrorCode.FACILITY_NOT_PUBLISHED }])).to.equal('unavailable')
        expect(correctionRefusal([{ code: ErrorCode.INVALID_LISTING_URL }])).to.equal('invalidListingUrl')
        expect(correctionRefusal([{ code: ErrorCode.CORRECTION_FIELD_WITHOUT_REASON }])).to.equal('invalid')
        expect(correctionRefusal([{ code: ErrorCode.NETWORK }])).to.equal('failed')
        expect(correctionRefusal(undefined)).to.equal('failed')
    })

    it('sends analytics as reason flags only', () => {
        const props = correctionSubmittedProps([FacilityCorrectionReason.Closed, FacilityCorrectionReason.Other])

        expect(Object.keys(props)).to.have.length(Object.values(FacilityCorrectionReason).length)
        expect(Object.values(props).every(value => value === 'yes' || value === 'no')).to.equal(true)
        expect(Object.entries(props).filter(([, value]) => value === 'yes').map(([key]) => key))
            .to.deep.equal(['closed', 'other'])
    })
})
