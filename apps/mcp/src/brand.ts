/**
 * How the server names itself to an MCP client. A client that shows servers by name and
 * icon reads `title`, `websiteUrl`, and `icons` from the initialize result, so it shows our
 * mark from our own domain instead of guessing one. Every URL is on www.findadoc.jp, which
 * serves the files from `apps/web/public`. Keep them in step with `SITE_LOGO` in
 * `apps/web/utils/site.ts` and with `.well-known/mcp/server-card.json`.
 */
export const SERVER_TITLE = 'Find a Doc, Japan'

export const SERVER_WEBSITE_URL = 'https://www.findadoc.jp'

export const SERVER_ICONS = [
    { src: `${SERVER_WEBSITE_URL}/findadoc-logo.png`, mimeType: 'image/png', sizes: ['512x512'] },
    { src: `${SERVER_WEBSITE_URL}/favicon.svg`, mimeType: 'image/svg+xml', sizes: ['any'] }
] as const satisfies ReadonlyArray<{ src: string, mimeType: string, sizes: readonly string[] }>
