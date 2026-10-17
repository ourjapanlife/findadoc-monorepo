import { gql } from 'graphql-request'
import { gqlClient, graphQLClientRequestWithRetry } from './graphql'
import type { HealthcareProfessional,
    HealthcareProfessionalSearchFilters,
    Facility,
    FacilitySearchFilters,
    Submission,
    SubmissionSearchFilters } from '@findadoc/graphql'
import {
    facilitySelection,
    professionalSelection,
    submissionSelection
} from './graphqlSelection'

/**
 * Fetches a paginated list of healthcare professionals along with their total count.
 * It uses the generic `graphQLClientRequestWithRetry` function, providing a specific
 * type for the response that includes both the list and the total count.
 *
 * @param filters An object containing search and pagination filters.
 * @returns A Promise that resolves to an object containing an array
 * of healthcare professionals (`filteredSearchResults`) and the total count.
 */
export async function fetchHealthcareProfessionalsWithCount(
    filters: HealthcareProfessionalSearchFilters
): Promise<{ filteredSearchResults: HealthcareProfessional[], totalCount: number }> {
    try {
        // We define the expected type of the GraphQL response here:
        // an object containing the list of professionals and the total count.
        const response = await graphQLClientRequestWithRetry<
            { healthcareProfessionals: HealthcareProfessional[], healthcareProfessionalsTotalCount: number }
        >(
            gqlClient.request.bind(gqlClient),
            healthcareProfessionalsAndCountGqlQuery,
            {
                listFilters: filters,
                countFilters: { ...filters, limit: undefined, offset: undefined }
            }
        )

        // Extract the list of professionals and the total count from the response data.
        const filteredSearchResults = response.data?.healthcareProfessionals ?? []
        const totalCount = response.data?.healthcareProfessionalsTotalCount ?? 0

        return { filteredSearchResults, totalCount }
    } catch (error) {
        console.error(`Error retrieving healthcare professionals: ${JSON.stringify(error)}`)
        throw new Error('Failed to retrieve healthcare professional data.', { cause: error })
    }
}

/**
 * Fetches a paginated list of facilities along with their total count.
 * This function follows the same pattern as the healthcare professionals fetcher.
 */
export async function fetchFacilitiesWithCount(
    filters: FacilitySearchFilters
): Promise<{ filteredSearchResults: Facility[], totalCount: number }> {
    try {
        // Object containthe list of facility and the total count.
        const response = await graphQLClientRequestWithRetry<
            { facilities: Facility[], facilitiesTotalCount: number }
        >(
            gqlClient.request.bind(gqlClient),
            facilitiesAndCountGqlQuery,
            {
                listFilters: filters,
                countFilters: { ...filters, limit: undefined, offset: undefined }
            }
        )

        const filteredSearchResults = response.data?.facilities ?? []
        const totalCount = response.data?.facilitiesTotalCount ?? 0

        return { filteredSearchResults, totalCount }
    } catch (error) {
        console.error(`Error retrieving facilities with count: ${JSON.stringify(error)}`)
        throw new Error('Failed to retrieve facility data.', { cause: error })
    }
}

/**
 * Fetches a paginated list of submissions along with their total count.
 * This function is used to retrieve data from the submission service.
 */
export async function fetchSubmissionsWithCount(
    filters: SubmissionSearchFilters
): Promise<{ filteredSearchResults: Submission[], totalCount: number }> {
    try {
        const response = await graphQLClientRequestWithRetry<
            { submissions: Submission[], submissionsTotalCount: number }
        >(
            gqlClient.request.bind(gqlClient),
            fetchSubmissionsAndCountGqlQuery,
            {
                listFilters: filters,
                countFilters: { ...filters, limit: undefined, offset: undefined }
            }
        )

        const filteredSearchResults = response.data?.submissions ?? []
        const totalCount = response.data?.submissionsTotalCount ?? 0

        return { filteredSearchResults, totalCount }
    } catch (error) {
        console.error(`Error retrieving submissions with count: ${JSON.stringify(error)}`)
        throw new Error('Failed to retrieve submission data.', { cause: error })
    }
}

const healthcareProfessionalsAndCountGqlQuery = gql`
    query HealthcareProfessionalsAndCount(
        $listFilters: HealthcareProfessionalSearchFilters!
        $countFilters: HealthcareProfessionalSearchFilters!
    ) {
        healthcareProfessionals(filters: $listFilters) {
            ${professionalSelection}
        }
        healthcareProfessionalsTotalCount(filters: $countFilters)
    }
`

export const facilitiesAndCountGqlQuery = gql`
    query FacilitiesAndCount(
        $listFilters: FacilitySearchFilters!
        $countFilters: FacilitySearchFilters!
    ) {
        facilities(filters: $listFilters) {
            ${facilitySelection}
        }
        facilitiesTotalCount(filters: $countFilters)
    }
`

const fetchSubmissionsAndCountGqlQuery = gql`
    query SubmissionsAndCount(
        $listFilters: SubmissionSearchFilters!,
        $countFilters: SubmissionSearchFilters!
    ) {
        submissions(filters: $listFilters) {
            ${submissionSelection}
        }
        submissionsTotalCount(filters: $countFilters)
    }
`
