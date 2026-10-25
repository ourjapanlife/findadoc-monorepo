import { describe, expect, it } from 'vitest'
import { GraphQLError, parse, type OperationDefinitionNode } from 'graphql'
import { isServerError, requestErrorFields, rootFieldNames } from '../src/requestErrors.js'

function operation(query: string): OperationDefinitionNode {
    return parse(query).definitions[0] as OperationDefinitionNode
}

// The shape convertErrorsToGqlErrors in resolvers.ts throws.
function serviceError(field: string, httpStatus: number): GraphQLError {
    return new GraphQLError('Validation Failed', {
        path: [field],
        extensions: { code: 'BAD_USER_INPUT', errors: [{ field, errorCode: 'X', httpStatus }] }
    })
}

describe('isServerError', () => {
    it('counts a wrapped service failure and an unexpected error, not a client mistake', () => {
        expect(isServerError(serviceError('facilities', 500))).toBe(true)
        expect(isServerError(serviceError('facilities', 400))).toBe(false)
        // A missing record is the caller's problem: not a Sentry event, not a failed search.
        expect(isServerError(serviceError('facility', 404))).toBe(false)
        expect(isServerError(new GraphQLError('boom'))).toBe(true)
        expect(isServerError(new GraphQLError('no', { extensions: { code: 'UNAUTHORIZED' } }))).toBe(false)
        expect(isServerError(new GraphQLError('bad', { extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }))).toBe(false)
    })
})

describe('requestErrorFields', () => {
    const search = operation('query SearchFacilities { facilities(filters: {}) { id } facilitiesTotalCount(filters: {}) }')

    it('lists the root fields and reports a search that failed on the server', () => {
        expect(rootFieldNames(search)).toEqual(['facilities', 'facilitiesTotalCount'])
        expect(requestErrorFields(search, [serviceError('facilities', 500)]))
            .toEqual({ rootFields: ['facilities', 'facilitiesTotalCount'], serverErrorCount: 1, searchFailed: true })
    })

    it('does not call a bad filter or a failed lookup a failed search', () => {
        expect(requestErrorFields(search, [serviceError('facilities', 400)]).searchFailed).toBe(false)

        const lookup = operation('{ facility(id: "x") { id } }')

        expect(requestErrorFields(lookup, [serviceError('facility', 500)]))
            .toEqual({ rootFields: ['facility'], serverErrorCount: 1, searchFailed: false })
        expect(requestErrorFields(search, undefined)).toEqual({
            rootFields: ['facilities', 'facilitiesTotalCount'],
            serverErrorCount: 0,
            searchFailed: false
        })
    })
})
