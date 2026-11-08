import { describe, expect, it } from 'vitest'
import { Degree } from '@findadoc/graphql'
import {
    HIDDEN_FROM_PICKER,
    LicenseRecommendation,
    LicenseReview,
    licenseColumnsForDegrees
} from '../src/licenses/professionalLicense.js'

describe('licenseColumnsForDegrees', () => {
    it('splits one clinical license from extra credentials', () => {
        expect(licenseColumnsForDegrees([Degree.Md, Degree.PhD, Degree.Mph])).toEqual({
            degrees: [Degree.Md, Degree.PhD, Degree.Mph],
            primaryLicense: Degree.Md,
            additionalCredentials: [Degree.PhD, Degree.Mph],
            licenseReview: null,
            licenseRecommendation: null
        })
    })

    it('queues MD and DO with an MD suggestion and does not choose a primary', () => {
        expect(licenseColumnsForDegrees([Degree.Do, Degree.Md, Degree.PhD])).toMatchObject({
            primaryLicense: null,
            additionalCredentials: [Degree.PhD],
            licenseReview: LicenseReview.NeedsReview,
            licenseRecommendation: LicenseRecommendation.Md
        })
    })

    it('queues DDS and DMD without picking either dental license', () => {
        expect(licenseColumnsForDegrees([Degree.Dds, Degree.Dmd])).toMatchObject({
            primaryLicense: null,
            licenseReview: LicenseReview.NeedsReview,
            licenseRecommendation: LicenseRecommendation.OneDentalLicense
        })
    })

    it('marks a dual license confirmed when the moderator confirms it without a primary', () => {
        expect(licenseColumnsForDegrees([Degree.Md, Degree.Do], { confirmed: true })).toMatchObject({
            primaryLicense: null,
            licenseReview: LicenseReview.Confirmed,
            licenseRecommendation: null
        })
    })

    it('keeps a repeated degree in the stored list', () => {
        expect(licenseColumnsForDegrees([Degree.PhD, Degree.PhD]).degrees).toEqual([Degree.PhD, Degree.PhD])
    })

    it('keeps a stored primary that is still in the submitted degrees', () => {
        expect(licenseColumnsForDegrees([Degree.Md, Degree.Do], {
            primaryLicense: Degree.Md,
            licenseReview: null
        })).toMatchObject({
            primaryLicense: Degree.Md,
            licenseReview: null,
            licenseRecommendation: null
        })
    })

    it('keeps that primary when the moderator confirms the row', () => {
        expect(licenseColumnsForDegrees([Degree.Md, Degree.Do], {
            confirmed: true,
            primaryLicense: Degree.Md,
            licenseReview: LicenseReview.Confirmed
        })).toMatchObject({
            primaryLicense: Degree.Md,
            licenseReview: LicenseReview.Confirmed
        })
    })

    it('does not invent MD when the moderator has not chosen a license', () => {
        expect(licenseColumnsForDegrees([])).toMatchObject({
            degrees: [],
            primaryLicense: null,
            licenseReview: null
        })
        expect(licenseColumnsForDegrees([Degree.PhD])).toMatchObject({
            degrees: [Degree.PhD],
            primaryLicense: null,
            additionalCredentials: [Degree.PhD]
        })
    })
})

describe('license picker', () => {
    it('hides DSW, DVM, and EdD', () => {
        expect(HIDDEN_FROM_PICKER).toEqual([Degree.Dsw, Degree.Dvm, Degree.EdD])
    })
})
