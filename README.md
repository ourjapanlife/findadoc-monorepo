# Find a Doc

pnpm workspace and Turborepo for the Find a Doc, Japan apps. One install, one set of GitHub Actions, and one generated GraphQL type package.

| Package | Path | What it is |
| --- | --- | --- |
| `@findadoc/web` | `apps/web` | Nuxt site (findadoc.jp) |
| `@findadoc/server` | `apps/server` | GraphQL API |
| `@findadoc/mcp` | `apps/mcp` | MCP server |
| `@findadoc/graphql` | `packages/graphql` | Types generated from the API schema |
| `@findadoc/tsconfig` | `packages/tsconfig` | Shared TypeScript config |

## Prerequisites

- Node.js 22 (see `.nvmrc`). `>=22.12.0` is required.
- Corepack, so pnpm 10.27.0 from the root `packageManager` field is used.
- Docker, only for the API's local Supabase database.

## Install

```bash
corepack enable
pnpm install
```

This repo uses a hoisted `node_modules`, which Nuxt expects. If the checkout lives in OneDrive, pnpm's file links can fail. Install with a copy instead:

```bash
pnpm install --config.package-import-method=copy
```

## Commands

Turborepo runs the task in every package that defines it. pnpm is the installer and the way to target one package.

```bash
pnpm dev                 # web, API, and MCP together
pnpm dev:web
pnpm dev:server          # starts local Supabase, resets, seeds, then the API
pnpm dev:mcp
pnpm dev:mcp:http

pnpm generate            # rewrite packages/graphql from the API schema
pnpm build
pnpm lint
pnpm typecheck
pnpm test                # web unit tests and MCP tests
pnpm test:server         # API tests; needs Supabase running
pnpm test:e2e            # Playwright, from the web app
pnpm lint:locales
```

Target one package when you do not want the whole workspace:

```bash
pnpm --filter @findadoc/web test:unit
pnpm --filter @findadoc/mcp dev:http
```

## Shared GraphQL types

`apps/server/src/typeDefs/schema.graphql` is the schema. `pnpm generate` writes `packages/graphql/src/index.ts`, and `pnpm --filter @findadoc/graphql build` compiles it. Web, the API, and the MCP server import that package:

```ts
import { Facility, Locale } from '@findadoc/graphql'
```

Do not add another codegen config or another copy of these types. CI regenerates the file and fails if it does not match the schema. A weekly Action opens a PR when `main` drifts.

Database types from Supabase stay in the API (`pnpm --filter @findadoc/server generate:db`). They describe Postgres, not the GraphQL schema.

## CI

| Workflow | What it runs |
| --- | --- |
| `ci.yml` | `turbo` lint and typecheck, web + MCP unit tests, schema/type drift check, API tests against Supabase |
| `playwright.yml` | API and web together, then Playwright |
| `lint-locales.yml` | Locale key check, with a PR comment when keys are missing |
| `lint-pr-title.yml` | Conventional Commits title |
| `generate-gql-types.yml` | Weekly regeneration of `@findadoc/graphql` |

Node is pinned by `.nvmrc` in every workflow. The API image builds from the repository root so it can install `@findadoc/server` and `@findadoc/graphql` together:

```bash
docker compose -f apps/server/docker/docker-compose-api.yml up -d --build
```
