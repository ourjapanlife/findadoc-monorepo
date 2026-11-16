import type { FacilityVerificationStatus, JapaneseInsurance } from '@findadoc/graphql'

/**
 * The facility fields a moderator can change after a clinic or doctor page is prerendered, and
 * that readers must see at once: the Japanese insurance answer (#18) and whether a person has
 * confirmed the listing (#22). The page re-reads them in the browser after load.
 */
export interface LiveFacilityFields {
    japaneseInsurance: JapaneseInsurance | null
    verificationStatus: FacilityVerificationStatus
}

/** The current fields for each facility id, read in the browser after a prerendered page loads. */
export type LiveFacilities = ReadonlyMap<string, LiveFacilityFields>

/**
 * The facility with its live fields, or unchanged when the browser has none for it
 * (not loaded yet, or the request failed). The built value is the fallback, never a guess.
 */
export function withLiveFacility<T extends {
    id: string
    japaneseInsurance?: JapaneseInsurance | null
    verificationStatus?: FacilityVerificationStatus
}>(facility: T, live: LiveFacilities): T {
    const fields = live.get(facility.id)
    if (fields === undefined) {
        return facility
    }

    return { ...facility, japaneseInsurance: fields.japaneseInsurance, verificationStatus: fields.verificationStatus }
}
