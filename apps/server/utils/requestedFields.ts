import type { GraphQLResolveInfo, SelectionSetNode } from 'graphql'

/**
 * Parses GraphQLResolveInfo to extract the set of top-level fields
 * requested by the client. Handles FragmentSpread and InlineFragment.
 */
export function getRequestedFields(info: GraphQLResolveInfo): Set<string> {
    const fields = new Set<string>()

    for (const fieldNode of info.fieldNodes) {
        if (fieldNode.selectionSet) {
            collectFields(fieldNode.selectionSet, info, fields)
        }
    }

    return fields
}

function collectFields(
    selectionSet: SelectionSetNode,
    info: GraphQLResolveInfo,
    fields: Set<string>
): void {
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
        case 'Field':
            fields.add(selection.name.value)
            break
        case 'FragmentSpread': {
            const fragment = info.fragments[selection.name.value]

            if (fragment) {
                collectFields(fragment.selectionSet, info, fields)
            }
            break
        }
        case 'InlineFragment':
            collectFields(selection.selectionSet, info, fields)
            break
        }
    }
}

/**
 * The most facilities one page may return. A list that does not ask for professional ids,
 * such as the sitemap, can take 1000. A list that does stays at 100.
 */
export function facilityListMaxLimit(info: GraphQLResolveInfo): number {
    return getRequestedFields(info).has('healthcareProfessionalIds') ? 100 : 1000
}
