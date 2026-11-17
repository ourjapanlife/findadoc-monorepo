import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getFacility } from '../core/facilities.js'

export function registerGetFacility(server: McpServer): void {
    server.registerTool(
        'get_facility',
        {
            description: 'Get full details for a single healthcare facility (clinic or hospital) in Japan by its ID. Typically called after search_facilities. Returns name, address, contact details, location, payment options (an empty list means unknown, not cash only), whether the clinic takes Japanese public health insurance (ACCEPTED, NOT_ACCEPTED, or null when unknown), languages the clinic itself supports (a clinic-level claim, not a promise that every doctor speaks them), opening hours in Japan time (an empty list means unknown; once known, a day with no block is closed), a short visitor note in English and Japanese, and the IDs of healthcare professionals at the facility.',
            inputSchema: {
                facilityId: z.string().describe('The unique ID of the facility (UUID)')
            }
        },
        async ({ facilityId }) => {
            try {
                const facility = await getFacility(facilityId)

                if (!facility) {
                    return {
                        content: [{ type: 'text', text: `No facility found with ID "${facilityId}".` }],
                        isError: true
                    }
                }

                return {
                    content: [{ type: 'text', text: JSON.stringify(facility, null, 2) }]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error'

                return {
                    content: [{ type: 'text', text: `Failed to get facility: ${message}` }],
                    isError: true
                }
            }
        }
    )
}
