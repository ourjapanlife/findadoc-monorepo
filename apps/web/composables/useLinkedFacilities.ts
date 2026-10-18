import { computed, ref, watch } from 'vue'
import { gql } from 'graphql-request'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql'
import {
    facilitiesForIds,
    linkedFacilityIds,
    type LinkedFacilityName
} from '~/utils/linkedFacilities'

const linkedFacilityQuery = gql`
    query LinkedFacility($id: ID!) {
        facility(id: $id) {
            id
            nameEn
            nameJa
        }
    }
`

export async function fetchFacilitiesByIds(ids: readonly string[]): Promise<LinkedFacilityName[]> {
    const unique = linkedFacilityIds(ids)
    const facilities = await Promise.all(unique.map(async id => {
        const response = await graphQLClientRequestWithRetry<{
            facility: { id: string, nameEn: string | null, nameJa: string | null } | null
        }>(
            gqlClient.request.bind(gqlClient),
            linkedFacilityQuery,
            { id }
        )
        const facility = response.hasErrors ? null : response.data?.facility
        return {
            id: facility?.id || id,
            nameEn: facility?.nameEn ?? '',
            nameJa: facility?.nameJa ?? ''
        }
    }))
    return facilities
}

export function useLinkedFacilities(
    ids: () => readonly string[] | null | undefined,
    loadFacilities: (ids: readonly string[]) => Promise<LinkedFacilityName[]> = fetchFacilitiesByIds
) {
    const byId = ref(new Map<string, LinkedFacilityName>())
    const linked = computed(() => facilitiesForIds(ids(), byId.value))

    function remember(facility: LinkedFacilityName) {
        const next = new Map(byId.value)
        next.set(facility.id, {
            id: facility.id,
            nameEn: facility.nameEn ?? '',
            nameJa: facility.nameJa ?? ''
        })
        byId.value = next
    }

    async function load(nextIds: readonly string[]) {
        const missing = linkedFacilityIds(nextIds).filter(id => !byId.value.has(id))
        if (!missing.length) {
            return
        }
        try {
            const fetched = await loadFacilities(missing)
            const next = new Map(byId.value)
            for (const facility of fetched) {
                next.set(facility.id, facility)
            }
            byId.value = next
        } catch {
            // The id stays visible until a later load can resolve the name.
        }
    }

    watch(
        () => linkedFacilityIds(ids()),
        nextIds => {
            if (!import.meta.client) {
                return
            }
            void load(nextIds)
        },
        { immediate: true }
    )

    return { linked, remember }
}
