import { onMounted, shallowRef } from 'vue'
import { fetchFacilityFromApi } from '~/utils/clinicFacility'
import type { LiveFacilities, LiveFacilityFields } from '~/utils/liveFacility'

/**
 * Clinic and doctor pages are prerendered, and a moderator can change a clinic's Japanese
 * insurance answer (#18) or confirm the listing (#22) after the build. A self-pay-only clinic must
 * not keep looking like an ordinary one, and a confirmed clinic must not keep asking readers to
 * confirm it, until the next publish. So the page re-reads those fields in the browser after load.
 * A failed read keeps the built value.
 */
export function useLiveFacility(facilityIds: () => readonly string[]) {
    const live = shallowRef<LiveFacilities>(new Map())

    onMounted(async () => {
        const ids = [...new Set(facilityIds())]
        const entries = await Promise.all(ids.map(async id => {
            try {
                const facility = await fetchFacilityFromApi(id)
                if (!facility) {
                    return null
                }

                const fields: LiveFacilityFields = {
                    japaneseInsurance: facility.japaneseInsurance ?? null,
                    verificationStatus: facility.verificationStatus
                }
                return [id, fields] as const
            } catch {
                return null
            }
        }))

        live.value = new Map(entries.filter((entry): entry is readonly [string, LiveFacilityFields] =>
            entry !== null))
    })

    return live
}
