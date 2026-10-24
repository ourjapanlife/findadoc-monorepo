# Architecture

## System Overview

Find a Doc is three apps in one monorepo, sharing the types generated from one GraphQL schema:

```
┌─────────────────┐     GraphQL     ┌──────────────────┐     SQL      ┌─────────────────┐
│    apps/web     │ ◄─────────────► │   apps/server    │ ◄──────────► │    Supabase     │
│  (Nuxt 4 site)  │                 │ (Apollo GraphQL) │              │  (PostgreSQL)   │
└─────────────────┘                 └──────────────────┘              └─────────────────┘
                                             ▲
                                             │ GraphQL
                                    ┌────────┴─────────┐
                                    │    apps/mcp      │ ◄── MCP / REST ── AI assistants
                                    │   (MCP server)   │
                                    └──────────────────┘
```

### Website (`apps/web`)

- **Framework**: Nuxt 4, prerendered with `nuxi generate` and hosted on Netlify
- **UI**: Vue 3 Composition API with Tailwind CSS
- **State**: Pinia stores
- **API**: GraphQL via `graphql-request`
- **Auth**: Auth0 (used for the moderation dashboard)
- **Maps**: Google Maps API for provider locations
- **i18n**: Nuxt i18n supporting 11 languages. Clinic, doctor, hub, and facet pages are prerendered in English and Japanese
- **Clinic landings**: a hosted page is a `clinic_sites` row. That id is what an account (`clinic_memberships`) and a future CRM attach to. The directory facility stays optional until the city is known. The clean link is `/clinic/{slug}`. `{slug}.findadoc.jp` opens the clinic at `/` on that host. The canonical stays the www path. DNS stays in Route 53. Local `pnpm dev` defaults to preview. Generate and Netlify stay off until `NUXT_PUBLIC_ONLINE_CLINIC` is `preview` (cookie) or `public`. When public and the row is published, search indexes that link. `/clinic/{prefecture}/{city}/{slug}--{id}` redirects to it. The link preview uses the clinic’s icon. A stored theme primary recolors that page’s header and buttons. The footer is the Find a Doc logo and “Powered by Find a Doc, Japan”. `admin.findadoc.jp` is the staff site (`NUXT_PUBLIC_ADMIN_SITE`, same cookie gate, always `noindex`). A hospital’s people are `facility_memberships`: the basic plan has three active seats, and each assign or revoke writes an audit log.

### API (`apps/server`)

- **Runtime**: Node.js with TypeScript
- **API**: Apollo Server on Fastify
- **Schema**: `apps/server/src/typeDefs/schema.graphql`, the only GraphQL schema in the repo
- **Database**: Supabase (PostgreSQL), with migrations in `apps/server/supabase`
- **Production**: Docker containers managed by PM2

### MCP Server (`apps/mcp`)

- **Protocol**: Model Context Protocol over Streamable HTTP and STDIO
- **Purpose**: Exposes healthcare provider data to AI assistants, and the same tools as REST endpoints

### Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/graphql` | `@findadoc/graphql`, TypeScript types generated from the schema. Regenerate with `pnpm generate` |
| `packages/utils` | `@findadoc/utils`, checks and helpers shared by the site and the API |
| `packages/tsconfig` | Shared TypeScript config |

## Website Directory Structure

| Directory | Purpose |
|-----------|---------|
| `apps/web/components/` | Reusable Vue components |
| `apps/web/pages/` | Route pages (auto-registered by Nuxt) |
| `apps/web/stores/` | Pinia stores |
| `apps/web/i18n/locales/` | Translation files, checked against `en.json` |
| `apps/web/assets/` | Uncompiled assets (CSS, images, fonts) |
| `apps/web/typedefs/` | TypeScript type definitions |
| `apps/web/public/` | Static files served at root (e.g., `robots.txt`) |

## Data Flow

1. Users search for healthcare providers on [findadoc.jp](https://www.findadoc.jp)
2. The website sends GraphQL queries to the API
3. The API resolves queries against the Supabase PostgreSQL database
4. Results are returned and displayed on an interactive map with provider details

## Further Reading

Rules that the code follows live next to it in the monorepo:

- `AGENTS.md`: notes for contributors and coding agents across the whole repo
- `apps/server/docs/city-rules.md`: how search cities are named
- `apps/server/docs/places-storage.md`: what Google Places data may be stored
