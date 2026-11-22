import { FacilityVerificationStatus } from '@findadoc/graphql'

/** What a moderator can choose. UNVERIFIED_LOCATION is not a choice: it means the facility has no city. */
export type FacilityVerificationChoice = FacilityVerificationStatus.Unverified | FacilityVerificationStatus.Confirmed

/** The form's choice for a stored status. Anything but CONFIRMED starts as unverified. */
export function facilityVerificationChoice(
    status: FacilityVerificationStatus | null | undefined
): FacilityVerificationChoice {
    return status === FacilityVerificationStatus.Confirmed
        ? FacilityVerificationStatus.Confirmed
        : FacilityVerificationStatus.Unverified
}

/**
 * The status to send on update, or undefined to leave it to the API.
 *
 * A facility with no city stays UNVERIFIED_LOCATION, and the API refuses CONFIRMED without one,
 * so nothing is sent then. The choice is sent when it differs from the saved status, and also
 * when the city changed: the API resets the status on a new city unless one is sent, and the
 * moderator saving the form has just chosen it for that city.
 */
export function changedVerificationStatus(
    choice: FacilityVerificationChoice,
    cityId: string,
    original: { verificationStatus?: FacilityVerificationStatus | null, cityId?: string | null }
): FacilityVerificationChoice | undefined {
    const nextCityId = cityId.trim()
    if (!nextCityId) {
        return undefined
    }

    const cityChanged = nextCityId !== (original.cityId ?? '')
    return choice !== original.verificationStatus || cityChanged ? choice : undefined
}
