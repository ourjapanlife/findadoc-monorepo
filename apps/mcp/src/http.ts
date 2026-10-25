import { buildMcpApp } from './app.js'

const app = await buildMcpApp()
const PORT = parseInt(process.env.PORT || '3000', 10)

app.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        app.log.error(err)
        process.exit(1)
    }

    // eslint-disable-next-line no-console
    console.log(`Find a Doc MCP server listening on ${address}/mcp`)
})
