# Find a Doc

pnpm workspace and Turborepo for the Find a Doc, Japan apps. One install, one set of GitHub Actions, and one generated GraphQL type package.

| Package | Path | What it is |
| --- | --- | --- |
| `@findadoc/web` | `apps/web` | Nuxt site (findadoc.jp) |
| `@findadoc/server` | `apps/server` | GraphQL API |
| `@findadoc/mcp` | `apps/mcp` | MCP server |
| `@findadoc/graphql` | `packages/graphql` | Types generated from the API schema |
| `@findadoc/utils` | `packages/utils` | Shared checks and helpers used by the site and the API |
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

Turborepo runs a task in every package that defines it. Root scripts call `pnpm exec turbo`, and each app adds a `turbo.json` that extends the root pipeline (`//`) with its own outputs. pnpm settings live in `pnpm-workspace.yaml`.

```bash
pnpm dev                 # site, fake GraphQL server, and MCP
pnpm dev:web             # same, without the MCP process
pnpm dev:server          # fake GraphQL server only
pnpm dev:seeded          # site against a reset, seeded local Supabase API
pnpm dev:api             # site against https://api.findadoc.jp
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

Do not add another codegen config or another copy of these types. On every pull request, and on pushes to `main`, CI regenerates `packages/graphql/src/index.ts` and fails if that file was not committed.

Database types from Supabase stay in the API (`pnpm --filter @findadoc/server generate:db`). They describe Postgres, not the GraphQL schema.

## CI

| Workflow | What it runs |
| --- | --- |
| `lint.yml` | `pnpm exec turbo lint`. Pull requests pass `--affected` |
| `typecheck.yml` | `pnpm exec turbo typecheck`, and a check that committed GraphQL types match the schema |
| `tests.yml` | Web, MCP, and utils unit tests, plus API tests against Supabase |
| `playwright.yml` | API and web together, then Playwright |
| `lint-locales.yml` | Locale key check, with a PR comment when keys are missing |
| `lint-pr-title.yml` | Conventional Commits title |

Node is pinned by `.nvmrc` in every workflow. The API image builds from the repository root so it can install `@findadoc/server` and `@findadoc/graphql` together:

```bash
docker compose -f apps/server/docker/docker-compose-api.yml up -d --build
```
