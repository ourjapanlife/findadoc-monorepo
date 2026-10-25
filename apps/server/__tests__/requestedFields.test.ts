import { describe, it, expect } from 'vitest'
import type { GraphQLResolveInfo, FieldNode, SelectionSetNode, FragmentDefinitionNode } from 'graphql'
import { getRequestedFields, facilityListMaxLimit } from '../utils/requestedFields'

// Helper to build a minimal GraphQLResolveInfo-like object for testing
function buildMockInfo(
    fieldNames: string[],
    fragments?: Record<string, { fields: string[] }>
): GraphQLResolveInfo {
    const selections = fieldNames.map(name => ({
        kind: 'Field' as const,
        name: { kind: 'Name' as const, value: name }
    }))

    const fragmentDefinitions: Record<string, FragmentDefinitionNode> = {}

    if (fragments) {
        for (const [fragName, fragDef] of Object.entries(fragments)) {
            fragmentDefinitions[fragName] = {
                kind: 'FragmentDefinition' as const,
                name: { kind: 'Name' as const, value: fragName },
                typeCondition: {
                    kind: 'NamedType' as const,
                    name: { kind: 'Name' as const, value: 'SomeType' }
                },
                selectionSet: {
                    kind: 'SelectionSet' as const,
                    selections: fragDef.fields.map(f => ({
                        kind: 'Field' as const,
                        name: { kind: 'Name' as const, value: f }
                    }))
                }
            } as FragmentDefinitionNode
        }
    }

    return {
        fieldNodes: [{
            kind: 'Field' as const,
            name: { kind: 'Name' as const, value: 'root' },
            selectionSet: {
                kind: 'SelectionSet' as const,
                selections
            } as SelectionSetNode
        } as FieldNode],
        fragments: fragmentDefinitions
    } as unknown as GraphQLResolveInfo
}

function buildMockInfoWithFragmentSpread(
    directFields: string[],
    fragmentName: string,
    fragmentFields: string[]
): GraphQLResolveInfo {
    const directSelections = directFields.map(name => ({
        kind: 'Field' as const,
        name: { kind: 'Name' as const, value: name }
    }))

    const fragmentSpread = {
        kind: 'FragmentSpread' as const,
        name: { kind: 'Name' as const, value: fragmentName }
    }

    const fragmentDefinitions: Record<string, FragmentDefinitionNode> = {
        [fragmentName]: {
            kind: 'FragmentDefinition' as const,
            name: { kind: 'Name' as const, value: fragmentName },
            typeCondition: {
                kind: 'NamedType' as const,
                name: { kind: 'Name' as const, value: 'SomeType' }
            },
            selectionSet: {
                kind: 'SelectionSet' as const,
                selections: fragmentFields.map(f => ({
                    kind: 'Field' as const,
                    name: { kind: 'Name' as const, value: f }
                }))
            }
        } as FragmentDefinitionNode
    }

    return {
        fieldNodes: [{
            kind: 'Field' as const,
            name: { kind: 'Name' as const, value: 'root' },
            selectionSet: {
                kind: 'SelectionSet' as const,
                selections: [...directSelections, fragmentSpread]
            } as SelectionSetNode
        } as FieldNode],
        fragments: fragmentDefinitions
    } as unknown as GraphQLResolveInfo
}

function buildMockInfoWithInlineFragment(
    directFields: string[],
    inlineFragmentFields: string[]
): GraphQLResolveInfo {
    const directSelections = directFields.map(name => ({
        kind: 'Field' as const,
        name: { kind: 'Name' as const, value: name }
    }))

    const inlineFragment = {
        kind: 'InlineFragment' as const,
        selectionSet: {
            kind: 'SelectionSet' as const,
            selections: inlineFragmentFields.map(f => ({
                kind: 'Field' as const,
                name: { kind: 'Name' as const, value: f }
            }))
        }
    }

    return {
        fieldNodes: [{
            kind: 'Field' as const,
            name: { kind: 'Name' as const, value: 'root' },
            selectionSet: {
                kind: 'SelectionSet' as const,
                selections: [...directSelections, inlineFragment]
            } as SelectionSetNode
        } as FieldNode],
        fragments: {}
    } as unknown as GraphQLResolveInfo
}

// --- getRequestedFields ---

describe('getRequestedFields', () => {
    it('extracts direct field selections', () => {
        const info = buildMockInfo(['id', 'nameEn', 'nameJa'])
        const fields = getRequestedFields(info)

        expect(fields).toEqual(new Set(['id', 'nameEn', 'nameJa']))
    })

    it('handles FragmentSpread', () => {
        const info = buildMockInfoWithFragmentSpread(
            ['id'],
            'FacilityFields',
            ['nameEn', 'contact']
        )
        const fields = getRequestedFields(info)

        expect(fields).toEqual(new Set(['id', 'nameEn', 'contact']))
    })

    it('handles InlineFragment', () => {
        const info = buildMockInfoWithInlineFragment(
            ['id'],
            ['nameJa', 'mapLatitude']
        )
        const fields = getRequestedFields(info)

        expect(fields).toEqual(new Set(['id', 'nameJa', 'mapLatitude']))
    })

    it('deduplicates fields from multiple sources', () => {
        const info = buildMockInfoWithFragmentSpread(
            ['id', 'nameEn'],
            'Extra',
            ['id', 'nameEn', 'contact']
        )
        const fields = getRequestedFields(info)

        expect(fields).toEqual(new Set(['id', 'nameEn', 'contact']))
    })
})

// --- Facility list page size ---

describe('facilityListMaxLimit', () => {
    it('keeps a list with professional ids at 100 rows', () => {
        expect(facilityListMaxLimit(buildMockInfo(['id', 'nameEn', 'healthcareProfessionalIds']))).toBe(100)
    })

    it('lets a list without professional ids take 1000 rows', () => {
        expect(facilityListMaxLimit(buildMockInfo(['id', 'nameEn', 'updatedDate']))).toBe(1000)
    })
})
