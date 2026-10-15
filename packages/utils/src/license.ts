import { Degree } from '@findadoc/graphql'

/** One clinical license. MD+DO and DDS+DMD stay in the moderator queue. */
export const CLINICAL_LICENSES: readonly Degree[] = [
    Degree.Cnm,
    Degree.Dc,
    Degree.Dds,
    Degree.Dmd,
    Degree.Dnp,
    Degree.Do,
    Degree.Dpm,
    Degree.Dpt,
    Degree.Md,
    Degree.Np,
    Degree.Od,
    Degree.Pa,
    Degree.PharmD,
    Degree.PsyD
]

export const ADDITIONAL_CREDENTIALS: readonly Degree[] = [
    Degree.DSc,
    Degree.Mph,
    Degree.PhD
]

/** Offered in the enum, hidden from the moderation picker until there is a use case. */
export const HIDDEN_FROM_PICKER: readonly Degree[] = [
    Degree.Dsw,
    Degree.Dvm,
    Degree.EdD
]

export const LicenseRecommendation = {
    Md: 'MD',
    OneDentalLicense: 'one_dental_license',
    ConfirmPrimary: 'confirm_primary'
} as const

export type LicenseRecommendationValue = typeof LicenseRecommendation[keyof typeof LicenseRecommendation]

export function recommendationFor(clinical: readonly Degree[]): LicenseRecommendationValue | null {
    const present = new Set(clinical)

    if (present.has(Degree.Md) && present.has(Degree.Do)) {
        return LicenseRecommendation.Md
    }

    if (present.has(Degree.Dds) && present.has(Degree.Dmd) && clinical.length === 2) {
        return LicenseRecommendation.OneDentalLicense
    }

    if (clinical.length > 1) {
        return LicenseRecommendation.ConfirmPrimary
    }

    return null
}
