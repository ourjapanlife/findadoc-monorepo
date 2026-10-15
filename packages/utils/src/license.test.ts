import { Degree } from '@findadoc/graphql'
import { describe, expect, it } from 'vitest'
import {
    ADDITIONAL_CREDENTIALS,
    CLINICAL_LICENSES,
    HIDDEN_FROM_PICKER,
    LicenseRecommendation,
    recommendationFor
} from './license.js'

describe('professional license lists', () => {
    it('keeps clinical licenses, credentials, and hidden degrees separate', () => {
        expect(CLINICAL_LICENSES).not.toEqual(expect.arrayContaining([...HIDDEN_FROM_PICKER]))
        expect(ADDITIONAL_CREDENTIALS).toEqual([Degree.DSc, Degree.Mph, Degree.PhD])
        expect(HIDDEN_FROM_PICKER).toEqual([Degree.Dsw, Degree.Dvm, Degree.EdD])
        expect(CLINICAL_LICENSES).toEqual(expect.arrayContaining([
            Degree.Md,
            Degree.Do,
            Degree.Dds,
            Degree.Dmd
        ]))
    })

    it('suggests a collapse and does not choose one license', () => {
        expect(recommendationFor([Degree.Md, Degree.Do])).toBe(LicenseRecommendation.Md)
        expect(recommendationFor([Degree.Dds, Degree.Dmd])).toBe(LicenseRecommendation.OneDentalLicense)
        expect(recommendationFor([Degree.Md, Degree.Np])).toBe(LicenseRecommendation.ConfirmPrimary)
        expect(recommendationFor([Degree.Do])).toBeNull()
    })
})
