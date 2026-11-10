import { gql } from 'graphql-request'
import { graphQLClientRequestWithRetry, publicReadRequest } from './graphql'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'
import type { ProfessionalSearchResult } from './clinicPrerender'
import { facilitySelection, professionalSelection } from './graphqlSelection'

const PUBLIC_REQUEST_OPTIONS = {
    skipAuth: true,
    retryAmount: 2,
    requestTimeoutInMilliseconds: 1500,
    abortAfterMs: 10000
}

const doctorProfessionalQuery = gql`
    query DoctorProfessional($id: ID!) {
        healthcareProfessional(id: $id) {
            ${professionalSelection}
        }
    }
`

const doctorFacilitiesQuery = gql`
    query DoctorFacilities($filters: FacilitySearchFilters!) {
        facilities(filters: $filters) {
            ${facilitySelection}
        }
    }
`

function doctorFromPrerenderDirectory(
    directory: Record<string, ProfessionalSearchResult> | undefined | null,
    id: string
): ProfessionalSearchResult | null | undefined {
    if (!directory || Object.keys(directory).length === 0) {
        return undefined
    }

    return directory[id] ?? null
}

async function doctorFromBundledDirectory(id: string): Promise<ProfessionalSearchResult | null | undefined> {
    try {
        const mod = await import('#doctor-directory')
        const directory = (mod.default ?? mod) as Record<string, ProfessionalSearchResult>
        return doctorFromPrerenderDirectory(directory, id)
    } catch {
        return undefined
    }
}

function facilitiesInListedOrder(
    professional: HealthcareProfessional,
    fetched: readonly Facility[]
): Facility[] {
    const byId = new Map(fetched.map(facility => [facility.id, facility]))
    const ordered = (professional.facilityIds ?? [])
        .map(id => byId.get(id))
        .filter((facility): facility is Facility => !!facility)

    if (ordered.length) {
        return ordered
    }

    return [...fetched]
}

export async function fetchDoctorById(id: string): Promise<ProfessionalSearchResult | null> {
    if (import.meta.server) {
        // Bundled, not runtime config, so a prerendered route does not copy the directory (#21).
        const fromBundle = await doctorFromBundledDirectory(id)
        if (fromBundle !== undefined) {
            return fromBundle
        }
    }

    const response = await graphQLClientRequestWithRetry<{
        healthcareProfessional?: HealthcareProfessional | null
    }>(
        publicReadRequest(),
        doctorProfessionalQuery,
        { id },
        PUBLIC_REQUEST_OPTIONS
    )

    const professional = response.data?.healthcareProfessional
    if (response.hasErrors || !professional) {
        return null
    }

    const facilitiesResponse = await graphQLClientRequestWithRetry<{ facilities?: Facility[] }>(
        publicReadRequest(),
        doctorFacilitiesQuery,
        { filters: { healthcareProfessionalIds: [id], limit: 100 } },
        PUBLIC_REQUEST_OPTIONS
    )

    const fetched = facilitiesResponse.hasErrors
        ? []
        : (facilitiesResponse.data?.facilities ?? [])

    return {
        ...professional,
        facilities: facilitiesInListedOrder(professional, fetched)
    }
}
