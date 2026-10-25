# Tech Stack

## Monorepo

| Technology | Purpose |
|-----------|---------|
| [pnpm](https://pnpm.io/) | Package manager and workspace |
| [Turborepo](https://turborepo.com/) | Runs tasks across packages |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) | Shared types in `@findadoc/graphql` |
| [ESLint](https://eslint.org/) | Linting |
| [Husky](https://typicode.github.io/husky/) | Git hooks |
| [GitHub Actions](https://docs.github.com/en/actions) | Lint, typecheck, tests, and docs deploy |

### Requirements

- **Node.js** 24.22.0 (see `.nvmrc`)
- **pnpm** 10.27.0 (via Corepack)

## Website (`apps/web`)

| Technology | Purpose |
|-----------|---------|
| [Nuxt 4](https://nuxt.com/) | Vue-based meta-framework, prerendered with `nuxi generate` |
| [Vue 3](https://vuejs.org/) | UI framework (Composition API) |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS framework |
| [Pinia](https://pinia.vuejs.org/) | State management |
| [graphql-request](https://github.com/jasonkuhrt/graphql-request) | Lightweight GraphQL client |
| [Nuxt i18n](https://i18n.nuxtjs.org/) | Internationalization (11 languages) |
| [Auth0](https://auth0.com/) | Authentication for moderation |
| [Google Maps API](https://developers.google.com/maps) | Map and location services |
| [Sentry](https://sentry.io/) | Error reporting |
| [Vitest](https://vitest.dev/) | Unit testing |
| [Playwright](https://playwright.dev/) | End-to-end testing |
| [Storybook](https://storybook.js.org/) | Component development and documentation |
| [AWS Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html) | Hosting |

## API (`apps/server`)

| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) | Runtime |
| [Apollo Server](https://www.apollographql.com/docs/apollo-server/) | GraphQL API on Fastify |
| [Amazon RDS for PostgreSQL](https://aws.amazon.com/rds/postgresql/) | Database |
| [Kysely](https://kysely.dev/) | Typed SQL queries to PostgreSQL |
| [Sentry](https://sentry.io/) | Error reporting |
| [AWS Lambda](https://aws.amazon.com/lambda/) and [CloudFront](https://aws.amazon.com/cloudfront/) | Hosting (production) |
| [AWS CDK](https://aws.amazon.com/cdk/) | Infrastructure as code (`infra/`) |
| [Docker](https://www.docker.com/) | Local Postgres database |
| [Vitest](https://vitest.dev/) | Testing |

## MCP Server (`apps/mcp`)

| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) | Runtime |
| [Model Context Protocol](https://modelcontextprotocol.io/) | AI tool integration over Streamable HTTP and STDIO |
| [Vitest](https://vitest.dev/) | Testing |

The MCP server exposes Find a Doc healthcare provider data to AI assistants. Its HTTP server also serves the same tools as REST endpoints described by `apps/mcp/openapi.yaml`.

## Documentation (`apps/docs`)

| Technology | Purpose |
|-----------|---------|
| [Zensical](https://zensical.org/) | Static site generator for this site |
| [GitHub Pages](https://pages.github.com/) | Hosting at [docs.findadoc.jp](https://docs.findadoc.jp) |

## Code Style

- All packages use **ESLint** with flat config
- PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) (enforced by CI)
- Branch names should be prefixed with your GitHub username: `yourusername/my-change`
