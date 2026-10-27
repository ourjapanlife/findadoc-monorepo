# Running the Code

Everything lives in one repository, [findadoc-monorepo](https://github.com/ourjapanlife/findadoc-monorepo). It is a pnpm workspace run by [Turborepo](https://turborepo.com/). Install once at the root and run every task from there.

## Prerequisites

- **Node.js** 24.22.0, pinned in `.nvmrc` (we recommend [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- **pnpm** 10.27.0, through [Corepack](https://nodejs.org/api/corepack.html)
- **Docker**, only for the API's local Postgres database
- **Python** 3.10 or later, only for this documentation site

**Recommended IDE plugins** (VS Code):

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Vue Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## Clone and Install

`nvm use` switches Node. Activate pnpm for that Node install before running `pnpm` or `turbo`. On Windows this step is required.

```bash
git clone https://github.com/ourjapanlife/findadoc-monorepo.git
cd findadoc-monorepo
nvm use
corepack enable
corepack prepare pnpm@10.27.0 --activate
pnpm install
```

`pnpm install` also sets up Husky, which lints before each commit.

If the checkout lives in OneDrive, pnpm's file links can fail. Install with a copy instead:

```bash
pnpm install --config.package-import-method=copy
```

## Start Everything

```bash
pnpm dev
```

This starts the website, the GraphQL API against a local database, and the MCP server. Other ways to start:

| Command | What it starts |
|---------|----------------|
| `pnpm dev` | Site, local API, and MCP server |
| `pnpm dev:web` | Site and local API, without the MCP server |
| `pnpm dev:seeded` | Resets and seeds the local database, then the site and API |
| `pnpm dev:api` | Site only, against the production API at `https://api.findadoc.jp` |
| `pnpm dev:server` | Local API only |
| `pnpm dev:mcp` | MCP server over STDIO |
| `pnpm dev:mcp:http` | MCP server over Streamable HTTP |

The site runs at `http://localhost:3000`. The API runs at `http://127.0.0.1:4000`.

## Website (`apps/web`)

### Moderation Dashboard

The moderation dashboard needs the local API:

1. Start the site and API: `pnpm dev:seeded`
2. Go to `http://localhost:3000/login`
3. Enter the username and password. Ask a core maintainer on Slack for credentials

### Clinic landings

A clinic that owns a page is a `clinic_sites` row, seeded from `apps/server/scripts/seed/clinicSiteContent.ts`. The first one is `/clinic/multilingual-online-clinic`. Its directory facility is `c32c316a-a368-499b-abaf-c5c973cb67e5`. The seed leaves that facility unresolved, because the page has no municipality. Accounts will attach through `clinic_memberships`. `pnpm dev` is Turbo and talks to the local API. Open `/clinic/multilingual-online-clinic?preview=1` to store a cookie for 30 days. Without that cookie the URL is a 404, `noindex`, and left out of the sitemap. `?preview=0` clears the cookie. There is no environment variable. Run the API against a seeded database so the page can load.

The link to put on a poster is `https://multilingual-online-clinic.findadoc.jp/`. The clinic breadcrumb, `/clinic/multilingual-online-clinic`, and the directory address that ends in `--{id}` redirect there. Booking is `https://multilingual-online-clinic.findadoc.jp/book` (or `/book/a303a8ac-31c9-45d8-96d1-cf6630aa11bd` on the main site, which redirects). The booking page has no clinic header—only the Find a Doc “Powered by” footer. On localhost, use “Save for autofill” to keep scalar answers in this browser. Leaving with unsaved answers shows the same leave guard as moderation. The preview image is that clinic’s icon. The landing header uses the clinic’s stored brand color. An admin of that hospital still edits the facility itself.

The same page answers two hosts. This starts the seeded API and the site:

```bash
pnpm dev:seeded
```

- Domain path: `http://127.0.0.1:3000/clinic/multilingual-online-clinic?preview=1`
- Clinic hostname: `http://multilingual-online-clinic.localhost:3000/?preview=1`

Browsers resolve `*.localhost` to this machine, so no hosts-file entry is required. The hostname itself is the clinic: `http://multilingual-online-clinic.localhost:3000/` stays on `/`, and `/book` is the intake form. Other pages on that host, including `/submit` and `/clinic/multilingual-online-clinic`, redirect to `/`. Images and scripts stay put. The preview cookie belongs to the host that set it, so each host needs its own `?preview=1`. `?preview=0` clears it on that host. The canonical URL is the subdomain.

`www`, `api`, `mcp`, `docs`, and `admin` are not clinic hosts.

The canonical URL is `https://{slug}.findadoc.jp/`. The www path and the shareable id are other doors, and both redirect to that host.

### Amplify and Route 53

The DNS zone stays in Route 53. Do not change the nameservers. Amplify already serves `*.findadoc.jp` for the production branch, so a clinic hostname is that wildcard. A pull request preview is a separate Amplify host. It is not `{slug}.findadoc.jp`. On that host, open `/clinic/multilingual-online-clinic?preview=1`. The build copies the app shell to that path, the query stores the cookie for 30 days, and the page reads the clinic from `https://api.findadoc.jp`. The showcase row has to be in that database. `*` does not include `findadoc.jp` itself. Records that already exist for `www`, `api`, `mcp`, and `docs` are more specific than `*` and stay as they are. The clinic slug does not change.

### Storybook

```bash
pnpm --filter @findadoc/web storybook
```

Storybook runs at `http://localhost:6006`.

### Production Build

```bash
pnpm --filter @findadoc/web build
```

This prerenders the site into `apps/web/.output/public`.

## API (`apps/server`)

!!! note
    The API needs Docker for its local Postgres database. `pnpm db:reset` starts it if it is not running.

```bash
pnpm db:start            # start the local Postgres database in Docker on 127.0.0.1:54322
pnpm check:db            # confirm the local database is running on 127.0.0.1:54322
pnpm db:reset            # drop and recreate the local database, then apply every migration
pnpm db:seed             # load the seed data
pnpm dev:server          # start the API
```

### Debugging

You can debug the API with VS Code: open the **Run and Debug** tab, choose **JavaScript Debug Terminal**, then run `pnpm dev:server` in that terminal. The debugger connects automatically. Add breakpoints by clicking on line numbers.

### Testing with Apollo Explorer

Once the API is running at `http://127.0.0.1:4000`:

1. Navigate to the **Explorer** section from the menu
2. Click **query: Query** under "Root Types"
3. Click the **+** button to see available fields
4. Select fields to add them to the query builder
5. For types requiring an ID (e.g., `Facility` or `HealthcareProfessional`), add the ID in the **Variables** window as a string

## MCP Server (`apps/mcp`)

```bash
pnpm dev:mcp             # STDIO, for Claude Code and the MCP Inspector
pnpm dev:mcp:http        # Streamable HTTP
pnpm --filter @findadoc/mcp build
```

See `apps/mcp/README.md` for the tool list and client setup.

## GraphQL Types

`apps/server/src/typeDefs/schema.graphql` is the only schema. The site, the API, and the MCP server import types generated from it through `@findadoc/graphql`. After you change the schema, regenerate them and commit `packages/graphql/src/index.ts`:

```bash
pnpm generate
pnpm --filter @findadoc/graphql build
```

CI fails if the committed types do not match the schema.

## Linting and Tests

```bash
pnpm lint                # every package
pnpm lint:fix
pnpm typecheck           # includes the locale key check
pnpm test                # web, MCP, and utils unit tests
pnpm test:server         # API tests; needs the local database
pnpm test:e2e            # Playwright, from the website
```

Run one package's task with `--filter`:

```bash
pnpm --filter @findadoc/web test:unit
```

## Documentation Site (`apps/docs`)

This site is built with [Zensical](https://zensical.org/). Install it once in a virtual environment:

```bash
cd apps/docs
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Then, from the repository root, with the virtual environment active:

```bash
pnpm docs                # preview at http://127.0.0.1:8000
pnpm docs:build          # write the site to apps/docs/site
pnpm lint:docs           # check the docs against the monorepo
```

See [Writing Docs](../contributing/docs.md) for when and how to update these pages.
