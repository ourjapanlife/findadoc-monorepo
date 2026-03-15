# Running the Code

## Prerequisites

- **Node.js** >= 22.12.0 (we recommend [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- **Yarn** 4.x — enabled via [Corepack](https://nodejs.org/api/corepack.html):

```bash
corepack enable
```

**Recommended IDE plugins** (VS Code):

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Vue Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## Documentation Site (findadoc-docs)

### Clone and Install

```bash
git clone https://github.com/ourjapanlife/findadoc-docs.git
cd findadoc-docs
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Start the Dev Server

```bash
zensical serve
```

The site will be available at `http://127.0.0.1:8000`.

### Build

```bash
zensical build --clean
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

This sets up Husky to run linting before commits, reducing common contributor mistakes.

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

The moderation dashboard requires a locally running backend:

1. Start the backend (see [Backend](#backend-findadoc-server) section below)
2. Start the frontend with local API: `yarn dev:localserver`
3. Go to `http://localhost:3000/login`
4. Enter the username and password — contact a core maintainer on Slack for credentials

### Generate GraphQL Types

TypeScript types for the GraphQL API are auto-generated. Run this after pulling new changes or when the API schema updates:

```bash
yarn generate
```

This generates the `gqlTypes.ts` file. Additional custom TypeScript types should go in the `./typedefs` folder.

### Linting

```bash
yarn lint        # Check for issues
yarn lint:fix    # Auto-fix issues
```

### Testing

```bash
# Unit tests
yarn test:unit

# E2E tests (opens Cypress GUI)
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

### Debugging

You can debug the backend with VS Code: open the **Run and Debug** tab, choose **JavaScript Debug Terminal**, then run `yarn dev` in that terminal. The debugger will automatically connect — just add breakpoints by clicking on line numbers.

### Testing with Apollo Explorer

Once the server is running at `http://localhost:4000`:

1. Navigate to the **Explorer** section from the menu
2. Click **query: Query** under "Root Types"
3. Click the **+** button to see available fields
4. Select fields to add them to the query builder
5. For types requiring an ID (e.g., `Facility` or `HealthcareProfessional`), add the ID in the **Variables** window as a string

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
