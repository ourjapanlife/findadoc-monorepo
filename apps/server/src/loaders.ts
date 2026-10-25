import DataLoader from 'dataloader'
import type { UserContext } from './auth.js'
import type { City } from '@findadoc/graphql'
import { getCitiesByIds } from './services/cityService.js'
import { hpIdsByFacilityIds } from './services/facilityService.js'
import { facilityIdsByHpIds } from './services/healthcareProfessionalService.js'

/**
 * Batch loaders for one GraphQL request. Every facility or professional in a response
 * asks for its relation ids and its city here, and each loader answers them with one query.
 * A new set is made per request, so nothing is cached across requests.
 */
export function createLoaders() {
    return {
        healthcareProfessionalIdsByFacility: new DataLoader<string, string[]>(async facilityIds => {
            const byFacility = await hpIdsByFacilityIds([...facilityIds])

            return facilityIds.map(id => byFacility.get(id) ?? [])
        }),
        facilityIdsByProfessional: new DataLoader<string, string[]>(async hpIds => {
            const byProfessional = await facilityIdsByHpIds([...hpIds])

            return hpIds.map(id => byProfessional.get(id) ?? [])
        }),
        cityById: new DataLoader<string, City | null>(async cityIds => {
            const byId = await getCitiesByIds(cityIds)

            return cityIds.map(id => byId.get(id) ?? null)
        })
    }
}

export type Loaders = ReturnType<typeof createLoaders>

/** The context every resolver receives: the signed-in user plus this request's loaders. */
export type ApiContext = UserContext & { loaders: Loaders }
