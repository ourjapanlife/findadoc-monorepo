# Architecture

## Overview

Find a Doc is composed of three main services:

```
┌─────────────────┐     GraphQL     ┌─────────────────┐     SQL      ┌─────────────┐
│  findadoc-web   │ ──────────────> │ findadoc-server  │ ──────────> │  Supabase    │
│  (Nuxt 3 SSG)   │                 │ (Node.js/GraphQL)│             │ (PostgreSQL) │
└─────────────────┘                 └─────────────────┘             └─────────────┘
                                           │
                                    ┌──────┴──────┐
                                    │ findadoc-mcp │
                                    │ (MCP Server) │
                                    └─────────────┘
```

## Frontend (findadoc-web)

The frontend is a **Nuxt 3** application running in **Static Site Generation (SSG)** mode.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable Vue.js components |
| `pages/` | Route pages (auto-routed by Nuxt) |
| `assets/` | Uncompiled assets (CSS, images, fonts) |
| `typedefs/` | TypeScript type definitions |
| `static/` | Static files mapped to root (e.g., `robots.txt`) |

### Theming

The app supports multiple color themes (light/dark variants) defined as CSS custom properties in `assets/css/tailwind.css`. The default theme uses:

- **Primary**: `#0EB0C0` (Teal)
- **Secondary**: `#FB9999` (Coral)
- **Accent**: `#1e40af` (Blue)

Themes are applied via CSS classes on the `<html>` element and use RGB space-separated values for Tailwind alpha channel support.

### State Management

State is managed with **Pinia** stores.

### API Communication

The frontend communicates with the backend via **GraphQL** using `graphql-request`. Run `yarn generate` to sync TypeScript types from the API schema.

### Internationalization

The app supports 10 languages via **Nuxt i18n**.

## Backend (findadoc-server)

The backend is a **Node.js** server exposing a **GraphQL** API.

- **Database**: Supabase (PostgreSQL)
- **Production**: Runs via PM2 inside Docker containers
- **Local Development**: Uses Supabase CLI for a local PostgreSQL instance

## MCP Server (findadoc-mcp)

The MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io/) to provide AI tools access to Find a Doc healthcare provider data.
