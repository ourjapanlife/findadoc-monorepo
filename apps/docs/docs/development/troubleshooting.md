# Troubleshooting

## Common Issues

### Node.js Version

The monorepo pins **Node.js 24.22.0** in `.nvmrc`. Check your version:

```bash
node --version
```

We recommend [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm). From the repository root:

```bash
nvm install
nvm use
```

### `Unable to find package manager binary`

`turbo` cannot find pnpm for the Node version you selected. Activate it after every `nvm use` that switches to a new Node install:

```bash
corepack enable
corepack prepare pnpm@10.27.0 --activate
```

### Install Fails in OneDrive

pnpm's file links can fail in a synced folder. Install with a copy instead:

```bash
pnpm install --config.package-import-method=copy
```

### Port Already in Use

If `pnpm dev` fails because port 3000 or 4000 is already in use:

```bash
# Find the process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### GraphQL Type Errors

If you get type errors after pulling new changes, regenerate and rebuild the shared GraphQL types:

```bash
pnpm generate
pnpm --filter @findadoc/graphql build
```

### ESLint Errors

Run the linter with auto-fix:

```bash
pnpm lint:fix
```

### Locale Key Check Fails

`pnpm typecheck` compares every locale file with `en.json`. Run the check alone to see which keys are missing or extra:

```bash
pnpm lint:locales
```

Add the translation. Do not copy the English sentence into another locale.

### Supabase Issues (API)

If the local Supabase instance isn't starting, make sure Docker is running, then:

```bash
pnpm check:db
pnpm db:reset
pnpm db:seed
```

A local database that is behind the current migrations can make the API return `INTERNAL_SERVER_ERROR`. Reset and seed it.

### Docs Check Fails

`pnpm lint:docs` fails when a page is missing its Japanese translation, a link is broken, or a command or version no longer matches the monorepo. The message names the file and line. See [Writing Docs](../contributing/docs.md).

## Getting Help

If you're stuck, don't hesitate to ask for help:

- **Slack**: Post in the [#dev-team](https://find-a-doc.slack.com/join/shared_invite/zt-2lb3j2t1z-O9F4thzcFktqsIXNzzjzHw#/shared-invite/email) channel
- **GitHub**: Open an [issue](https://github.com/ourjapanlife/findadoc-monorepo/issues) or comment on an existing one
