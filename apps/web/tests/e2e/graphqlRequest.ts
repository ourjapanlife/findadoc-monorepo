import type { Request } from '@playwright/test'

export interface GraphQLOperation {
    query: string
    variables?: Record<string, unknown>
}

/**
 * The GraphQL operation a mocked route received. Public reads are GETs with the query in
 * the URL (#242); everything else is a JSON POST. A mock that only reads the POST body
 * lets public reads fall through to the real API.
 */
export function graphqlOperation(request: Request): GraphQLOperation | null {
    if (request.method() === 'GET') {
        const params = new URL(request.url()).searchParams
        const variables = params.get('variables')
        return {
            query: params.get('query') ?? '',
            variables: variables ? JSON.parse(variables) as Record<string, unknown> : undefined
        }
    }
    return request.postDataJSON() as GraphQLOperation | null
}
