# Running the Code

## Prerequisites

- **Node.js** >= 22.12.0 — we recommend using [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) and running `nvm use` in the project directory
- **Yarn** 4.x — enabled via [Corepack](https://nodejs.org/api/corepack.html):

```bash
corepack enable
```

## Frontend (findadoc-web)

### Clone and Install

```bash
git clone https://github.com/ourjapanlife/findadoc-web.git
cd findadoc-web
yarn install
```

### Set Up Git Hooks

```bash
yarn prepare
```

This sets up Husky to automatically run linting before commits and reduce common mistakes.

### Start the Dev Server

```bash
yarn dev
```

The site will be available at `http://localhost:3000`.

### Run with Local API

To connect to a locally running backend:

```bash
yarn dev:localserver
```

### Moderation Dashboard

To work on the moderation panel:

1. Start the backend (see Backend section below)
2. Start the frontend with local API: `yarn dev:localserver`
3. Go to `localhost:3000/login` and enter the username and password
4. Contact one of the maintainers on Slack for credentials

!!! warning
    Do **not** use `yarn dev` when working on the moderation panel. Use `yarn dev:localserver` instead.

### Generate GraphQL Types

```bash
yarn generate
```

This generates the `gqlTypes.ts` file with any schema updates from the server API.

### Linting

```bash
yarn lint        # Check for issues
yarn lint:fix    # Auto-fix issues
```

### Testing

```bash
# Unit tests
yarn test:unit

# E2E tests (opens Cypress)
yarn test:e2e

# E2E tests (headless)
yarn test:e2e:headless
```

### Storybook

```bash
yarn storybook
```

Storybook will be available at `http://localhost:6006`.

### Production Build

```bash
yarn prod:build
```

### Debugging with VS Code

Open the **Run and Debug** tab in VS Code, choose **JavaScript Debug Terminal**, then run `yarn dev` in that terminal. The debugger will automatically connect — just add breakpoints by clicking on the line number.

## Backend (findadoc-server)

!!! note
    The backend requires Docker and Supabase CLI for the local database.

### Clone and Install

```bash
git clone https://github.com/ourjapanlife/findadoc-server.git
cd findadoc-server
yarn install
```

### Start the Dev Server

This will start Supabase, seed the database, generate types, and start the dev server:

```bash
yarn dev
```

### Testing with Apollo Explorer

1. Run `yarn dev` to start the local server
2. Open your browser to `http://localhost:4000/`
3. Navigate to the **Explorer** section from the menu in the left pane
4. Click **query: Query** under "Root Types"
5. Click the **+** button to see the fields a type has that can be added to the query
6. Select the desired fields and they'll automatically get added to the query builder
7. If you select a type that requires an ID (such as `Facility` or `HealthcareProfessional`), add the ID in the **Variables** window at the bottom as a string

!!! tip
    Use Apollo Explorer's sharing features to share queries, such as when demonstrating how you tested your code.

### Testing

```bash
yarn test
```

### Linting

```bash
yarn lint
```

## MCP Server (findadoc-mcp)

### Clone and Install

```bash
git clone https://github.com/ourjapanlife/findadoc-mcp.git
cd findadoc-mcp
yarn install
```

### Development

```bash
yarn dev
```

### Build

```bash
yarn build
```

### Testing

```bash
yarn test
yarn test:watch
```
