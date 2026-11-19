import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listLanguages } from '../core/taxonomy.js'

export function registerListLanguages(server: McpServer): void {
    server.registerTool(
        'list_languages',
        {
            description: 'List the spoken languages you can search by in Find a Doc. Each entry has a `code` (e.g. "en_US") to pass to the `spokenLanguages` filter on search_healthcare_professionals, and its name in English, Japanese, and its own language. Only codes with `published: true` are search filters; another code returns no results. By default only those are listed.',
            inputSchema: {
                includeUnpublished: z.boolean().default(false)
                    .describe('Also list language codes that are not search filters. Leave false to search.')
            }
        },
        async ({ includeUnpublished }) => {
            try {
                const data = await listLanguages(includeUnpublished)

                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error'

                return {
                    content: [{ type: 'text', text: `Failed to list languages: ${message}` }],
                    isError: true
                }
            }
        }
    )
}
