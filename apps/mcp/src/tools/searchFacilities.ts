import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchFacilities } from '../core/facilities.js'

export function registerSearchFacilities(server: McpServer): void {
    server.registerTool(
        'search_facilities',
        {
            description: 'Search for healthcare facilities (clinics and hospitals) in Japan. '
                + 'Filter by prefecture, spoken language, and specialty in one call, '
                + 'e.g. English-speaking internal medicine in Okinawa. '
                + 'Returns name, address (with city), phone, website, clinic-level languages, '
                + 'and the IDs of healthcare professionals at each facility. '
                + 'There is no city filter: filter by prefecture and narrow by address.cityEn. '
                + 'Use list_languages and list_specialties for valid filter values.',
            inputSchema: {
                limit: z.number().min(1).max(50).default(10).describe('Number of results to return (1-50)'),
                offset: z.number().min(0).default(0).describe('Number of results to skip for pagination'),
                nameEn: z.string().optional().describe('Filter by the English facility name (partial match)'),
                nameJa: z.string().optional().describe('Filter by the Japanese facility name (partial match)'),
                healthcareProfessionalName: z.string().optional().describe('Filter to facilities that have a healthcare professional matching this name'),
                prefecture: z.string().max(20).optional()
                    .describe('Filter by prefecture: English key (e.g. "Okinawa") or Japanese name (e.g. "沖縄県")'),
                spokenLanguages: z.array(z.string().max(10)).max(5).optional()
                    .describe('Only facilities where these languages are supported (e.g. "en_US"). Use list_languages'),
                specialties: z.array(z.string().max(40)).max(5).optional()
                    .describe('Only facilities with a professional in all of these specialties (e.g. "INTERNAL_MEDICINE")')
            }
        },
        async params => {
            try {
                const data = await searchFacilities(params)

                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error'

                return {
                    content: [{ type: 'text', text: `Failed to search facilities: ${message}` }],
                    isError: true
                }
            }
        }
    )
}
