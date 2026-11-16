import { describe, expect, it } from 'vitest'
import { FacilityVerificationStatus, JapaneseInsurance } from '@findadoc/graphql'
import { correctionPromptVariant } from '~/utils/facilityCorrection'
import { withLiveFacility, type LiveFacilityFields } from '~/utils/liveFacility'

function liveFor(fields: Partial<LiveFacilityFields>) {
    return new Map([['facility-1', {
        japaneseInsurance: null,
        verificationStatus: FacilityVerificationStatus.Unverified,
        ...fields
    } satisfies LiveFacilityFields]])
}

describe('withLiveFacility', () => {
    const built = {
        id: 'facility-1',
        japaneseInsurance: null,
        verificationStatus: FacilityVerificationStatus.Unverified
    }

    it('shows a self-pay answer set after the build', () => {
        const live = liveFor({ japaneseInsurance: JapaneseInsurance.NotAccepted })
        expect(withLiveFacility(built, live).japaneseInsurance).toBe(JapaneseInsurance.NotAccepted)
    })

    it('clears an answer that went back to unknown after the build', () => {
        const answered = { ...built, japaneseInsurance: JapaneseInsurance.NotAccepted }
        expect(withLiveFacility(answered, liveFor({})).japaneseInsurance).toBeNull()
    })

    it('swaps the confirm card for the error link when a moderator confirms after the build', () => {
        const live = liveFor({ verificationStatus: FacilityVerificationStatus.Confirmed })
        const facility = withLiveFacility(built, live)
        expect(facility.verificationStatus).toBe(FacilityVerificationStatus.Confirmed)
        expect(correctionPromptVariant(facility.verificationStatus)).toBe('error')
    })

    it('brings back the confirm card when a confirmed listing is reopened after the build', () => {
        const confirmed = { ...built, verificationStatus: FacilityVerificationStatus.Confirmed }
        const facility = withLiveFacility(confirmed, liveFor({}))
        expect(correctionPromptVariant(facility.verificationStatus)).toBe('confirm')
    })

    it('keeps the built values when the browser has no live read', () => {
        const confirmed = {
            ...built,
            japaneseInsurance: JapaneseInsurance.NotAccepted,
            verificationStatus: FacilityVerificationStatus.Confirmed
        }
        expect(withLiveFacility(confirmed, new Map())).toBe(confirmed)
    })

    it('leaves other facilities alone', () => {
        const other = { ...built, id: 'facility-2' }
        const live = liveFor({ verificationStatus: FacilityVerificationStatus.Confirmed })
        expect(withLiveFacility(other, live)).toBe(other)
    })
})
