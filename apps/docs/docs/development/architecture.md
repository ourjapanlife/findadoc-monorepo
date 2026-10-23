# Architecture

## System Overview

Find a Doc is composed of three main services:

```
┌─────────────────┐     GraphQL     ┌─────────────────┐     SQL      ┌─────────────────┐
│  findadoc-web   │ ◄─────────────► │ findadoc-server  │ ◄──────────► │    Supabase      │
│  (Nuxt 3 SSG)   │                 │ (Node.js/GraphQL)│              │  (PostgreSQL)    │
└─────────────────┘                 └─────────────────┘              └─────────────────┘
                                           ▲
                                           │ MCP Protocol
                                    ┌──────┴──────────┐
                                    │  findadoc-mcp    │
                                    │  (MCP Server)    │
                                    └─────────────────┘
```

### findadoc-web (Frontend)

- **Framework**: Nuxt 3 in static site generation (SSG) mode
- **UI**: Vue 3 Composition API with Tailwind CSS
- **State**: Pinia stores
- **API**: GraphQL via `graphql-request`
- **Auth**: Auth0 (used for the moderation dashboard)
- **Maps**: Google Maps API for provider locations
- **i18n**: Nuxt i18n supporting 10 languages

### findadoc-server (Backend)

- **Runtime**: Node.js with TypeScript
- **API**: GraphQL
- **Database**: Supabase (PostgreSQL)
- **Production**: Docker containers managed by PM2

### findadoc-mcp (MCP Server)

- **Protocol**: Model Context Protocol for AI tool integrations
- **Purpose**: Exposes healthcare provider data to AI assistants

## Frontend Directory Structure

| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable Vue components |
| `pages/` | Route pages (auto-registered by Nuxt) |
| `assets/` | Uncompiled assets (CSS, images, fonts) |
| `typedefs/` | TypeScript type definitions |
| `public/` | Static files served at root (e.g., `robots.txt`) |

## Data Flow

1. Users search for healthcare providers on [findadoc.jp](https://www.findadoc.jp)
2. The frontend sends GraphQL queries to the backend API
3. The backend resolves queries against the Supabase PostgreSQL database
4. Results are returned and displayed on an interactive map with provider details
