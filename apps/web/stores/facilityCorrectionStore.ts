import { gql } from 'graphql-request'
import { defineStore } from 'pinia'
import type { Facility, FacilityCorrectionInput, FacilityCorrectionResult } from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql'
import { facilitySelection } from '~/utils/graphqlSelection'
import type { ServerResponse } from '~/typedefs/serverResponse'

/** A visitor is signed out, and a slow answer should fail rather than hang the form. */
const PUBLIC_REQUEST_OPTIONS = {
    skipAuth: true,
    retryAmount: 1,
    requestTimeoutInMilliseconds: 3000,
    abortAfterMs: 10000
}

/** The clinic page correction form (#22): what the clinic shows now, and the report the visitor sends. */
export const useFacilityCorrectionStore = defineStore('facilityCorrectionStore', () => {
    /**
     * The clinic page is prerendered, so its values can be days old. The form starts from
     * what the API holds now, and falls back to the page when that read fails.
     */
    async function fetchCurrentFacility(facilityId: string): Promise<Facility | null> {
        const response = await graphQLClientRequestWithRetry<{ facility?: Facility | null }>(
            gqlClient.request.bind(gqlClient),
            currentFacilityQuery,
            { id: facilityId },
            PUBLIC_REQUEST_OPTIONS
        )
        if (response.hasErrors) {
            return null
        }
        return response.data?.facility ?? null
    }

    async function submitCorrection(
        input: FacilityCorrectionInput
    ): Promise<ServerResponse<{ submitFacilityCorrection: FacilityCorrectionResult }>> {
        return graphQLClientRequestWithRetry<{ submitFacilityCorrection: FacilityCorrectionResult }>(
            gqlClient.request.bind(gqlClient),
            submitFacilityCorrectionMutation,
            { input },
            // A retry could file the same report twice, so a correction is sent once.
            { ...PUBLIC_REQUEST_OPTIONS, retryAmount: 0 }
        )
    }

    return { fetchCurrentFacility, submitCorrection }
})

const currentFacilityQuery = gql`
    query CorrectionFacility($id: ID!) {
        facility(id: $id) {
            ${facilitySelection}
        }
    }
`

const submitFacilityCorrectionMutation = gql`
    mutation SubmitFacilityCorrection($input: FacilityCorrectionInput!) {
        submitFacilityCorrection(input: $input) {
            isSuccessful
        }
    }
`
