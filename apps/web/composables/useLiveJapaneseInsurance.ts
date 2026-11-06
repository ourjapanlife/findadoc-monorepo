import { onMounted, shallowRef } from 'vue'
import type { JapaneseInsurance } from '@findadoc/graphql'
import { fetchFacilityFromApi } from '~/utils/clinicFacility'
import type { LiveJapaneseInsurance } from '~/utils/japaneseInsurance'

/**
 * Clinic and doctor pages are prerendered, and a moderator can change a clinic's Japanese
 * insurance answer after the build (#18). A self-pay-only clinic must not keep looking like
 * an ordinary one until the next publish, so the page re-reads each facility's answer in the
 * browser after load. A failed read keeps the built value.
 */
export function useLiveJapaneseInsurance(facilityIds: () => readonly string[]) {
    const live = shallowRef<LiveJapaneseInsurance>(new Map())

    onMounted(async () => {
        const ids = [...new Set(facilityIds())]
        const answers = await Promise.all(ids.map(async id => {
            try {
                const facility = await fetchFacilityFromApi(id)
                return facility ? [id, facility.japaneseInsurance ?? null] as const : null
            } catch {
                return null
            }
        }))

        live.value = new Map(answers.filter((answer): answer is readonly [string, JapaneseInsurance | null] =>
            answer !== null))
    })

    return live
}
