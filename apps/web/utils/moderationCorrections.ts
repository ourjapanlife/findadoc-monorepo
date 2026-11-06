import { gql } from 'graphql-request'
import type { Facility, Submission } from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql'
import { facilitySelection, submissionSelection } from '~/utils/graphqlSelection'

/**
 * Reads for the correction review in moderation (#22). A correction row stores only the
 * facility id, so the list and the review load the clinic it points at.
 */

export type CorrectionFacilityName = Pick<Facility, 'id' | 'nameEn' | 'nameJa'>

/** One request carries at most this many facilities. */
const NAMES_PER_REQUEST = 50

/** `f0: facility(id: $id0)`, one alias per id. The ids are bound variables, never pasted into the query. */
function facilityNamesQuery(count: number): string {
    const variables = Array.from({ length: count }, (_, index) => `$id${index}: ID!`).join(', ')
    const fields = Array.from(
        { length: count },
        (_, index) => `f${index}: facility(id: $id${index}) { id nameEn nameJa }`
    ).join('\n')
    return `query CorrectionFacilityNames(${variables}) {\n${fields}\n}`
}

/** The names of these facilities, by id. A facility that is gone, or a failed request, is left out. */
export async function fetchCorrectionFacilityNames(
    ids: readonly string[]
): Promise<Record<string, CorrectionFacilityName>> {
    const unique = [...new Set(ids)]
    const names: Record<string, CorrectionFacilityName> = {}

    for (let start = 0; start < unique.length; start += NAMES_PER_REQUEST) {
        const chunk = unique.slice(start, start + NAMES_PER_REQUEST)
        const variables = Object.fromEntries(chunk.map((id, index) => [`id${index}`, id]))
        const response = await graphQLClientRequestWithRetry<Record<string, CorrectionFacilityName | null>>(
            gqlClient.request.bind(gqlClient),
            facilityNamesQuery(chunk.length),
            variables
        )
        if (response.hasErrors) {
            continue
        }
        for (const facility of Object.values(response.data ?? {})) {
            if (facility) {
                names[facility.id] = facility
            }
        }
    }

    return names
}

const correctionFacilityQuery = gql`
    query CorrectionFacility($id: ID!) {
        facility(id: $id) {
            ${facilitySelection}
        }
    }
`

/** What the clinic page shows now: the "before" side of the review. */
export async function fetchCorrectionFacility(id: string): Promise<Facility | null> {
    const response = await graphQLClientRequestWithRetry<{ facility: Facility | null }>(
        gqlClient.request.bind(gqlClient),
        correctionFacilityQuery,
        { id }
    )
    return response.hasErrors ? null : response.data?.facility ?? null
}

const submissionByIdQuery = gql`
    query ModerationSubmission($id: ID!) {
        submission(id: $id) {
            ${submissionSelection}
        }
    }
`

/** One submission, for a review opened from a link or after a reload. */
export async function fetchSubmissionById(id: string): Promise<Submission | null> {
    const response = await graphQLClientRequestWithRetry<{ submission: Submission | null }>(
        gqlClient.request.bind(gqlClient),
        submissionByIdQuery,
        { id }
    )
    return response.hasErrors ? null : response.data?.submission ?? null
}
