import type { GraphQLError, OperationDefinitionNode } from 'graphql'

/** Root fields that run a directory search or count. A server-side failure in one is a failed search. */
export const SEARCH_ROOT_FIELDS: ReadonlySet<string> = new Set([
    'facilities',
    'facilitiesTotalCount',
    'healthcareProfessionals',
    'healthcareProfessionalsTotalCount',
    'cityFacilities'
])

// Codes for a request the client got wrong. They are answered in the response, not alerted on.
const CLIENT_ERROR_CODES: ReadonlySet<string> = new Set([
    'BAD_USER_INPUT',
    'UNAUTHORIZED',
    'GRAPHQL_PARSE_FAILED',
    'GRAPHQL_VALIDATION_FAILED',
    'BAD_REQUEST',
    'PERSISTED_QUERY_NOT_FOUND',
    'OPERATION_RESOLUTION_FAILURE'
])

type ServiceError = { httpStatus?: number }

/**
 * Whether an error is the server's fault: Sentry reports these, and searchFailed counts them.
 * Resolvers wrap every service error as BAD_USER_INPUT, including a database failure, so a
 * wrapped error with an httpStatus of 500 or more is a server error too. A missing record is 404.
 */
export function isServerError(error: Pick<GraphQLError, 'extensions'>): boolean {
    const code = String(error.extensions?.code ?? 'INTERNAL_SERVER_ERROR')
    const serviceErrors = (error.extensions?.errors ?? []) as ServiceError[]

    if (code === 'BAD_USER_INPUT') {
        return serviceErrors.some(serviceError => (serviceError.httpStatus ?? 0) >= 500)
    }

    return !CLIENT_ERROR_CODES.has(code)
}

/** The fields selected at the top of the operation, such as `facilities`. */
export function rootFieldNames(operation: OperationDefinitionNode | null | undefined): string[] {
    return (operation?.selectionSet.selections ?? [])
        .flatMap(selection => (selection.kind === 'Field' && selection.name.value !== '__typename'
            ? [selection.name.value]
            : []))
}

/**
 * Fields for the one log line per request. `searchFailed` is true when a search root
 * field failed on the server side. The API's CloudWatch metric filter alarms on it.
 */
export function requestErrorFields(
    operation: OperationDefinitionNode | null | undefined,
    errors: readonly Pick<GraphQLError, 'extensions' | 'path'>[] | undefined
): { rootFields: string[], serverErrorCount: number, searchFailed: boolean } {
    const serverErrors = (errors ?? []).filter(isServerError)

    return {
        rootFields: rootFieldNames(operation),
        serverErrorCount: serverErrors.length,
        searchFailed: serverErrors.some(error => SEARCH_ROOT_FIELDS.has(String(error.path?.[0])))
    }
}
