# Tech Stack

## Frontend (findadoc-web)

| Technology | Purpose |
|-----------|---------|
| [Nuxt 3](https://nuxt.com/) | Vue-based meta-framework (SSG mode) |
| [Vue 3](https://vuejs.org/) | UI framework (Composition API) |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| [Pinia](https://pinia.vuejs.org/) | State management |
| [GraphQL](https://graphql.org/) | API query language |
| [graphql-request](https://github.com/jasonkuhrt/graphql-request) | Lightweight GraphQL client |
| [Nuxt i18n](https://i18n.nuxtjs.org/) | Internationalization (10 languages) |
| [Auth0](https://auth0.com/) | Authentication |
| [Google Maps API](https://developers.google.com/maps) | Map and location services |
| [Vitest](https://vitest.dev/) | Unit testing |
| [Cypress](https://www.cypress.io/) | End-to-end testing |
| [Storybook](https://storybook.js.org/) | Component development and documentation |
| [ESLint](https://eslint.org/) | Linting |
| [Husky](https://typicode.github.io/husky/) | Git hooks |

### Requirements

- **Node.js** >= 22.12.0
- **Yarn** 4.x (via Corepack)

### Recommended IDE Plugins

These provide automatic linting and IntelliSense instead of having to run `yarn lint` manually:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) — Linting integration
- [Vue Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) — Vue 3 language support
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) — Tailwind class autocomplete

## Backend (findadoc-server)

| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) | Runtime |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [GraphQL](https://graphql.org/) | API layer |
| [Supabase](https://supabase.com/) | Database (PostgreSQL) |
| [PM2](https://pm2.keymetrics.io/) | Process management (production) |
| [Docker](https://www.docker.com/) | Containerization |
| [Vitest](https://vitest.dev/) | Testing |

!!! note
    The backend repo is not currently accepting external contributors, but you're welcome to explore the code. Contributions are welcome in the [frontend repo](https://github.com/ourjapanlife/findadoc-web).

## MCP Server (findadoc-mcp)

| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) | Runtime |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Model Context Protocol](https://modelcontextprotocol.io/) | AI tool integration |

The MCP server provides AI-powered tools for interacting with Find a Doc healthcare provider data.

## Code Style

- All projects use **ESLint** with flat config
- PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) (enforced by CI)
- Branch names should be prefixed with your GitHub username: `yourusername/my-change`
- TypeScript types should be located in the `./typedefs` folder
- Run `yarn generate` to sync GraphQL API schema types (generates the `gqlTypes.ts` file)
