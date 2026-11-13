import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { SpecialtyCategory } from '@findadoc/graphql'
import { listSpecialties } from '../core/taxonomy.js'

export function registerListSpecialties(server: McpServer): void {
    server.registerTool(
        'list_specialties',
        {
            description: 'List the medical specialties in Find a Doc, with English and Japanese names, and the categories that group them (e.g. MENTAL_HEALTH holds PSYCHIATRY). Use a specialty `code` as a value for the `specialties` filter on search_healthcare_professionals. Search filters on specialties, not categories: to search a category, pass its specialty codes. Pass `category` to get only that category\'s specialties.',
            inputSchema: {
                category: z.enum(SpecialtyCategory).optional()
                    .describe('Only the specialties in this category, e.g. "MENTAL_HEALTH" or "DENTAL"')
            }
        },
        async ({ category }) => {
            try {
                const data = await listSpecialties(category)

                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error'

                return {
                    content: [{ type: 'text', text: `Failed to list specialties: ${message}` }],
                    isError: true
                }
            }
        }
    )
}
