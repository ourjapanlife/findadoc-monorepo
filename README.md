# Find a Doc

pnpm workspace and Turborepo for the Find a Doc, Japan apps. One install, one set of GitHub Actions, and one generated GraphQL type package.

| Package | Path | What it is |
| --- | --- | --- |
| `@findadoc/web` | `apps/web` | Nuxt site (findadoc.jp) |
| `@findadoc/server` | `apps/server` | GraphQL API |
| `@findadoc/mcp` | `apps/mcp` | MCP server |
| `@findadoc/docs` | `apps/docs` | Contributor docs ([docs.findadoc.jp](https://docs.findadoc.jp)) |
| `@findadoc/graphql` | `packages/graphql` | Types generated from the API schema |
| `@findadoc/utils` | `packages/utils` | Shared checks and helpers used by the site and the API |
| `@findadoc/tsconfig` | `packages/tsconfig` | Shared TypeScript config |

## Prerequisites

- Node.js 24.22.0 (see `.nvmrc`). Nuxt accepts `^22.21.0`, `^24.11.0`, or `>=26.0.0`.
- Corepack, so pnpm 10.27.0 from the root `packageManager` field is used.
- Docker, only for the API's local Postgres database.

## Install

`nvm use` switches the Node directory. The pnpm command lives in that directory, so activate it for the Node version you just selected. On Windows this is required before `turbo` or `pnpm` will run:

```bash
nvm use
corepack enable
corepack prepare pnpm@10.27.0 --activate
pnpm install
```

This repo uses a hoisted `node_modules`, which Nuxt expects. If the checkout lives in OneDrive, pnpm's file links can fail. Install with a copy instead:

```bash
pnpm install --config.package-import-method=copy
```

## Commands

Turborepo runs a task in every package that defines it. Root scripts call `pnpm exec turbo`, and each app adds a `turbo.json` that extends the root pipeline (`//`) with its own outputs. pnpm settings live in `pnpm-workspace.yaml`.

```bash
pnpm dev                 # site, local GraphQL API (local database), and MCP
pnpm dev:web             # same, without the MCP process
pnpm dev:server          # local GraphQL API only
pnpm dev:seeded          # reset and seed the local database, then the site against that API
pnpm dev:api             # site against https://api.findadoc.jp
pnpm db:start            # local Postgres in Docker on 127.0.0.1:54322 (db:reset starts it too)
pnpm db:stop             # stop it; the data volume stays
pnpm check:db            # confirm the local database answers
pnpm db:seed             # load the TypeScript seed into the local database
pnpm db:reset            # drop and recreate the local database only, then apply every migration
pnpm dev:mcp
pnpm dev:mcp:http

pnpm generate            # rewrite packages/graphql from the API schema
pnpm build
pnpm lint
pnpm typecheck           # includes the locale key check
pnpm test                # web unit tests and MCP tests
pnpm test:server         # API tests; needs the local database
pnpm test:e2e            # Playwright, from the web app
pnpm lint:locales        # the locale key check alone, without the rest of typecheck
pnpm lint:docs           # check apps/docs against the scripts and versions in this repo
pnpm docs                # preview apps/docs; needs Zensical (see apps/docs/README.md)
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

Database table types stay in the API (`apps/server/src/typeDefs/kyselyTypes.ts`). They describe Postgres, not the GraphQL schema.

## CI

| Workflow | What it runs |
| --- | --- |
| `lint.yml` | `pnpm exec turbo lint`. Pull requests pass `--affected` |
| `typecheck.yml` | `pnpm exec turbo typecheck`, including the locale key check, and a check that committed GraphQL types match the schema |
| `tests.yml` | Web, MCP, and utils unit tests, plus API tests against Postgres in Docker |
| `playwright.yml` | API and web together, then Playwright |
| `lint-pr-title.yml` | Conventional Commits title |
| `docs.yml` | Docs check and build on every pull request. Deploys `apps/docs` to GitHub Pages from `main` |

Node is pinned by `.nvmrc` in every workflow. The API and the MCP server run on AWS Lambda, deployed by the Infra workflow from `infra/` (see `infra/README.md`).
