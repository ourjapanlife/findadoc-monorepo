import { Degree } from '@findadoc/graphql'
import {
    ADDITIONAL_CREDENTIALS,
    CLINICAL_LICENSES,
    HIDDEN_FROM_PICKER,
    LicenseRecommendation,
    recommendationFor,
    type LicenseRecommendationValue
} from '@findadoc/utils'

/**
 * One clinical license, with extra credentials stored separately (#1014).
 * MD+DO and DDS+DMD stay in the moderator queue. A confirmed dual is left alone.
 */

export {
    ADDITIONAL_CREDENTIALS,
    CLINICAL_LICENSES,
    HIDDEN_FROM_PICKER,
    LicenseRecommendation,
    recommendationFor,
    type LicenseRecommendationValue
}

export const LicenseReview = {
    NeedsReview: 'NEEDS_REVIEW',
    Confirmed: 'CONFIRMED'
} as const

export type LicenseReviewValue = typeof LicenseReview[keyof typeof LicenseReview]

export type LicenseColumns = {
    degrees: Degree[]
    primaryLicense: Degree | null
    additionalCredentials: Degree[]
    licenseReview: LicenseReviewValue | null
    licenseRecommendation: LicenseRecommendationValue | null
}

const DEGREE_VALUES = new Set<string>(Object.values(Degree))

function asList(value: readonly string[] | null | undefined): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

/** Known degrees in the submitted order, including repeats. The public list stores this array. */
export function listedDegrees(degrees: readonly string[] | null | undefined): Degree[] {
    return asList(degrees).filter((degree): degree is Degree => DEGREE_VALUES.has(degree))
}

export function knownDegrees(degrees: readonly string[] | null | undefined): Degree[] {
    const seen = new Set<string>()
    const unique: Degree[] = []

    for (const degree of listedDegrees(degrees)) {
        if (seen.has(degree)) {
            continue
        }
        seen.add(degree)
        unique.push(degree)
    }

    return unique
}

export function clinicalLicensesIn(degrees: readonly Degree[]): Degree[] {
    return degrees.filter(degree => CLINICAL_LICENSES.includes(degree))
}

export function credentialsIn(degrees: readonly Degree[]): Degree[] {
    return degrees.filter(degree => ADDITIONAL_CREDENTIALS.includes(degree))
}

function storedReview(value: string | null | undefined): LicenseReviewValue | null {
    if (value === LicenseReview.NeedsReview || value === LicenseReview.Confirmed) {
        return value
    }

    return null
}

export function licenseColumnsForDegrees(
    degrees: readonly string[] | null | undefined,
    options?: {
        confirmed?: boolean
        primaryLicense?: string | null
        licenseReview?: string | null
    }
): LicenseColumns {
    const listed = listedDegrees(degrees)
    const unique = knownDegrees(degrees)
    const clinical = clinicalLicensesIn(unique)
    const additionalCredentials = credentialsIn(unique)
    const recommendation = recommendationFor(clinical)
    const keptPrimary = options?.primaryLicense && clinical.includes(options.primaryLicense as Degree)
        ? options.primaryLicense as Degree
        : null

    if (keptPrimary) {
        return {
            degrees: listed,
            primaryLicense: keptPrimary,
            additionalCredentials,
            licenseReview: options?.confirmed ? LicenseReview.Confirmed : storedReview(options?.licenseReview),
            licenseRecommendation: null
        }
    }

    if (options?.confirmed && recommendation) {
        return {
            degrees: listed,
            primaryLicense: null,
            additionalCredentials,
            licenseReview: LicenseReview.Confirmed,
            licenseRecommendation: null
        }
    }

    if (recommendation) {
        return {
            degrees: listed,
            primaryLicense: null,
            additionalCredentials,
            licenseReview: LicenseReview.NeedsReview,
            licenseRecommendation: recommendation
        }
    }

    return {
        degrees: listed,
        primaryLicense: clinical[0] ?? null,
        additionalCredentials,
        licenseReview: null,
        licenseRecommendation: null
    }
}
