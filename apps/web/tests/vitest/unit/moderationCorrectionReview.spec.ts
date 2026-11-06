/// <reference types="vitest/globals" />
import { expect } from 'chai'
import {
    FacilityCorrectionReason,
    Locale,
    PaymentType,
    SubmissionKind,
    type FacilityCorrection
} from '@findadoc/graphql'
import {
    addressLines,
    correctionChangeRows,
    correctionHandOffReasons,
    correctionNeedsCity,
    duplicateListingHref,
    type CorrectionReviewFacility
} from '@/utils/facilityCorrectionReview'
import {
    isOpenCorrection,
    moderationPills,
    moderationStatus,
    MODERATION_STATUS
} from '@/utils/moderationSubmissionStatus'
import { sentenceKeyForServerCode } from '@/utils/formErrorMessage'

// Fake clinic only.
const ADDRESS = {
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

const CONTACT = {
    email: 'front-desk@example.com',
    phone: '03-5555-0100',
    website: 'https://example-clinic.test',
    googleMapsUrl: 'https://maps.google.com/?q=35.66,139.73',
    address: ADDRESS
}

const FACILITY: CorrectionReviewFacility = {
    contact: CONTACT,
    supportedLanguages: [Locale.EnUs, Locale.JaJp],
    paymentOptions: [
        { paymentType: PaymentType.Cash, paymentBrands: [] },
        { paymentType: PaymentType.CreditCard, paymentBrands: ['VISA'] }
    ]
}

function correction(overrides: Partial<FacilityCorrection> = {}): FacilityCorrection {
    return {
        facilityId: '6f1c2a5e-4b3d-4c2a-9e1f-0a1b2c3d4e5f',
        reasons: [],
        changes: {},
        reporterRelation: null,
        duplicateListingUrl: null,
        ...overrides
    }
}

const PENDING = { isUnderReview: false, isApproved: false, isRejected: false }

describe('moderation status (#22)', () => {
    it('reads the database status', () => {
        expect(moderationStatus(PENDING)).to.equal(MODERATION_STATUS.New)
        expect(moderationStatus({ ...PENDING, isUnderReview: true })).to.equal(MODERATION_STATUS.UnderReview)
        expect(moderationStatus({ ...PENDING, isApproved: true })).to.equal(MODERATION_STATUS.Approved)
        expect(moderationStatus({ ...PENDING, isRejected: true })).to.equal(MODERATION_STATUS.Declined)
    })

    it('tags a correction as Feedback after its status, and a listing with its status only', () => {
        expect(moderationPills({ ...PENDING, kind: SubmissionKind.Correction })).to.deep.equal(['NEW', 'FEEDBACK'])
        expect(moderationPills({ ...PENDING, isApproved: true, kind: SubmissionKind.Listing })).to.deep.equal(['APPROVED'])
    })

    it('keeps new and under-review corrections in User feedback, and nothing that is decided', () => {
        const kind = SubmissionKind.Correction
        expect(isOpenCorrection({ ...PENDING, kind })).to.equal(true)
        expect(isOpenCorrection({ ...PENDING, isUnderReview: true, kind })).to.equal(true)
        expect(isOpenCorrection({ ...PENDING, isApproved: true, kind })).to.equal(false)
        expect(isOpenCorrection({ ...PENDING, isRejected: true, kind })).to.equal(false)
        expect(isOpenCorrection({ ...PENDING, kind: SubmissionKind.Listing })).to.equal(false)
    })
})

describe('correction review rows (#22)', () => {
    it('shows only the fields the visitor sent', () => {
        const rows = correctionChangeRows(FACILITY, correction({
            reasons: [FacilityCorrectionReason.WrongContact, FacilityCorrectionReason.Other],
            changes: { phone: '03-5555-0142' }
        }))

        expect(rows.map(row => row.field)).to.deep.equal(['phone'])
        expect(rows[0]?.before).to.deep.equal(['03-5555-0100'])
        expect(rows[0]?.after).to.deep.equal(['03-5555-0142'])
        expect(rows[0]?.reason).to.equal(FacilityCorrectionReason.WrongContact)
    })

    it('marks the languages a visitor added and removed', () => {
        const [row] = correctionChangeRows(FACILITY, correction({
            reasons: [FacilityCorrectionReason.WrongLanguages],
            changes: { supportedLanguages: [Locale.JaJp, Locale.ZhCn] }
        }))

        expect(row?.list).to.equal(true)
        expect(row?.added).to.deep.equal([Locale.ZhCn])
        expect(row?.removed).to.deep.equal([Locale.EnUs])
    })

    it('compares payment types, not brands', () => {
        const [row] = correctionChangeRows(FACILITY, correction({
            reasons: [FacilityCorrectionReason.WrongPayment],
            changes: { paymentOptions: [{ paymentType: PaymentType.Cash, paymentBrands: [] }] }
        }))

        expect(row?.before).to.deep.equal([PaymentType.Cash, PaymentType.CreditCard])
        expect(row?.removed).to.deep.equal([PaymentType.CreditCard])
        expect(row?.added).to.deep.equal([])
    })

    it('follows the order of the reasons, whatever order the visitor picked them in', () => {
        const rows = correctionChangeRows(FACILITY, correction({
            reasons: [FacilityCorrectionReason.WrongContact, FacilityCorrectionReason.WrongCity],
            changes: {
                website: 'https://new-example-clinic.test',
                phone: '03-5555-0142',
                address: { ...ADDRESS, cityEn: 'Shibuya', cityJa: '渋谷区' }
            }
        }))

        expect(rows.map(row => row.field)).to.deep.equal(['address', 'phone', 'website'])
    })

    it('shows an empty side when the clinic lists nothing yet', () => {
        const [row] = correctionChangeRows(
            { ...FACILITY, contact: { ...CONTACT, website: '' } },
            correction({
                reasons: [FacilityCorrectionReason.WrongContact],
                changes: { website: 'https://example-clinic.test' }
            })
        )

        expect(row?.before).to.deep.equal([])
        expect(row?.after).to.deep.equal(['https://example-clinic.test'])
    })

    it('has no row for a reason without a field', () => {
        const rows = correctionChangeRows(FACILITY, correction({
            reasons: [FacilityCorrectionReason.Closed, FacilityCorrectionReason.Duplicate]
        }))

        expect(rows).to.deep.equal([])
    })

    it('writes the address as one English line and one Japanese line', () => {
        expect(addressLines(ADDRESS)).to.deep.equal([
            '1-2-3 Roppongi Example Building 4F, Minato, Tokyo 106-0032',
            '〒106-0032 東京都港区六本木1-2-3サンプルビル4階'
        ])
        expect(addressLines(null)).to.deep.equal([])
    })
})

describe('what a moderator decides by hand (#22)', () => {
    it('asks for a city only when the visitor reported a wrong city', () => {
        expect(correctionNeedsCity(correction({ reasons: [FacilityCorrectionReason.WrongCity] }))).to.equal(true)
        expect(correctionNeedsCity(correction({ reasons: [FacilityCorrectionReason.WrongContact] }))).to.equal(false)
    })

    it('hands Closed and Duplicate back to the moderator', () => {
        const reasons = correctionHandOffReasons(correction({
            reasons: [
                FacilityCorrectionReason.Closed,
                FacilityCorrectionReason.WrongLanguages,
                FacilityCorrectionReason.Duplicate
            ]
        }))

        expect(reasons).to.deep.equal([FacilityCorrectionReason.Closed, FacilityCorrectionReason.Duplicate])
    })

    it('links the other listing only when it is an https Find a Doc page', () => {
        const listing = 'https://findadoc.jp/clinic/tokyo/minato/example--6f1c2a5e-4b3d-4c2a-9e1f-0a1b2c3d4e5f'
        expect(duplicateListingHref(listing)).to.equal(listing)
        expect(duplicateListingHref('http://findadoc.jp/clinic/x')).to.equal(null)
        expect(duplicateListingHref('https://example.test/clinic/x')).to.equal(null)
        expect(duplicateListingHref('javascript:alert(1)')).to.equal(null)
        expect(duplicateListingHref('')).to.equal(null)
        expect(duplicateListingHref(null)).to.equal(null)
    })

    it('explains the correction refusals instead of the generic sentence', () => {
        expect(sentenceKeyForServerCode('CORRECTION_CITY_REQUIRED')).to.equal('serverErrorMessages.correctionCityRequired')
        expect(sentenceKeyForServerCode('SUBMISSION_STATUS_CHANGED')).to.equal('serverErrorMessages.submissionStatusChanged')
        expect(sentenceKeyForServerCode('SUBMISSION_KIND_MISMATCH')).to.equal('serverErrorMessages.submissionKindMismatch')
    })
})
