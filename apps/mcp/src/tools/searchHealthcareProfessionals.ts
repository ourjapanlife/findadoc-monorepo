import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchHealthcareProfessionals } from '../core/professionals.js'

export function registerSearchHealthcareProfessionals(server: McpServer): void {
    server.registerTool(
        'search_healthcare_professionals',
        {
            description: 'Search for healthcare professionals in Japan. Returns names, specialties, spoken languages, degrees, and associated facility IDs. Japanese public insurance is on the facility.',
            inputSchema: {
                limit: z.number().min(1).max(50).default(10).describe('Number of results to return (1-50)'),
                offset: z.number().min(0).default(0).describe('Number of results to skip for pagination'),
                spokenLanguages: z.array(z.string()).optional().describe('Filter by spoken languages (e.g. "en_US", "ja_JP"). Use list_languages for valid values'),
                specialties: z.array(z.string()).optional().describe('Filter by medical specialties (e.g. "GENERAL_MEDICINE", "PEDIATRICS", "INTERNAL_MEDICINE"). Use list_specialties for valid values'),
                degrees: z.array(z.string()).optional().describe('Filter by degrees (e.g. "MD", "DO", "PhD")')
            }
        },
        async params => {
            try {
                const data = await searchHealthcareProfessionals(params)

                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error'

                return {
                    content: [{ type: 'text', text: `Failed to search healthcare professionals: ${message}` }],
                    isError: true
                }
            }
        }
    )
}
