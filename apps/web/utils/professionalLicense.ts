import { Degree } from '@findadoc/graphql'
import {
    ADDITIONAL_CREDENTIALS as PICKER_CREDENTIALS,
    CLINICAL_LICENSES as PICKER_PRIMARY_LICENSES,
    HIDDEN_FROM_PICKER,
    recommendationFor
} from '@findadoc/utils'

export {
    HIDDEN_FROM_PICKER,
    PICKER_CREDENTIALS,
    PICKER_PRIMARY_LICENSES,
    recommendationFor
}

export type LicenseRecommendation = 'MD' | 'one_dental_license' | 'confirm_primary'

export type LicenseFormState = {
    primaryLicense: Degree | null
    additionalCredentials: Degree[]
    preservedClinicalLicenses: Degree[]
    hiddenDegrees: Degree[]
    recommendation: LicenseRecommendation | null
}

function uniqueDegrees(degrees: readonly Degree[] | null | undefined): Degree[] {
    const seen = new Set<Degree>()
    const unique: Degree[] = []

    for (const degree of degrees ?? []) {
        if (seen.has(degree)) {
            continue
        }
        seen.add(degree)
        unique.push(degree)
    }

    return unique
}

export function formStateFromDegrees(degrees: readonly Degree[] | null | undefined): LicenseFormState {
    const unique = uniqueDegrees(degrees)
    const preservedClinicalLicenses = unique.filter(degree => PICKER_PRIMARY_LICENSES.includes(degree))
    const additionalCredentials = unique.filter(degree => PICKER_CREDENTIALS.includes(degree))
    const hiddenDegrees = unique.filter(degree => HIDDEN_FROM_PICKER.includes(degree))

    const onlyClinicalLicense = preservedClinicalLicenses.length === 1
        ? preservedClinicalLicenses[0] ?? null
        : null

    return {
        primaryLicense: onlyClinicalLicense,
        additionalCredentials,
        preservedClinicalLicenses,
        hiddenDegrees,
        recommendation: recommendationFor(preservedClinicalLicenses)
    }
}

export function degreesFromForm(state: {
    primaryLicense: Degree | null
    additionalCredentials: readonly Degree[]
    preservedClinicalLicenses: readonly Degree[]
    hiddenDegrees: readonly Degree[]
    keepBoth: boolean
}): Degree[] {
    const clinical = state.keepBoth || !state.primaryLicense
        ? state.preservedClinicalLicenses
        : [state.primaryLicense]

    return uniqueDegrees([...clinical, ...state.additionalCredentials, ...state.hiddenDegrees])
}
