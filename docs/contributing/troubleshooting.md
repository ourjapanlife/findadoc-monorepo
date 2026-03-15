# Troubleshooting

## Common Issues

### Node.js Version

Find a Doc requires **Node.js >= 22.12.0**. Check your version:

```bash
node --version
```

We recommend using [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage Node.js versions:

```bash
nvm install 22
nvm use 22
```

### Yarn / Corepack Issues

The project uses Yarn 4.x via Corepack. If you encounter Yarn errors:

```bash
corepack enable
corepack prepare yarn@4 --activate
```

### Port Already in Use

If `yarn dev` fails because port 3000 is already in use:

```bash
# Find the process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

Or start the dev server on a different port:

```bash
npx nuxi dev --port 3001
```

### GraphQL Type Generation Errors

If you get type errors after pulling new changes, regenerate the GraphQL types:

```bash
yarn generate
```

### ESLint Errors

Run the linter with auto-fix:

```bash
yarn lint:fix
```

### Supabase Issues (Backend)

If the local Supabase instance isn't starting:

```bash
# Make sure Docker is running, then:
npx supabase start
npx supabase db reset
```

## Getting Help

If you're stuck, don't hesitate to ask for help:

- **Slack**: Post in [#frontend-team](https://find-a-doc.slack.com/join/shared_invite/zt-2lb3j2t1z-O9F4thzcFktqsIXNzzjzHw#/shared-invite/email)
- **GitHub**: Open an issue or comment on an existing one
