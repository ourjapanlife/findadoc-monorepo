import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SERVER_ICONS, SERVER_TITLE, SERVER_WEBSITE_URL } from './brand.js'
import { registerHealthcheck } from './tools/healthcheck.js'
import { registerSearchHealthcareProfessionals } from './tools/searchHealthcareProfessionals.js'
import { registerSearchFacilities } from './tools/searchFacilities.js'
import { registerGetFacility } from './tools/getFacility.js'
import { registerGetHealthcareProfessional } from './tools/getHealthcareProfessional.js'
import { registerListSpecialties } from './tools/listSpecialties.js'
import { registerListLanguages } from './tools/listLanguages.js'

export function createServer(): McpServer {
    const server = new McpServer({
        name: 'findadoc-mcp',
        title: SERVER_TITLE,
        version: '0.1.0',
        websiteUrl: SERVER_WEBSITE_URL,
        icons: SERVER_ICONS.map(icon => ({ ...icon, sizes: [...icon.sizes] }))
    })

    registerHealthcheck(server)
    registerSearchHealthcareProfessionals(server)
    registerSearchFacilities(server)
    registerGetFacility(server)
    registerGetHealthcareProfessional(server)
    registerListSpecialties(server)
    registerListLanguages(server)

    return server
}
