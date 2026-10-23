# Writing Docs

This site lives in the monorepo at `apps/docs`, next to the code it describes. Update it in the same pull request as the change that makes it out of date.

## When to Update the Docs

Update the docs in your pull request when you:

- Add, rename, or remove a `pnpm` script that contributors run
- Change the Node.js or pnpm version
- Add, remove, or rename an app or package
- Change how something is set up, run, tested, or deployed
- Replace a technology in the [Tech Stack](../development/tech-stack.md)
- Change the [Architecture](../development/architecture.md) or the contribution workflow

The pull request template asks you to confirm this.

## How Pages Are Organized

- English pages live in `apps/docs/docs/` (e.g., `development/tech-stack.md`)
- Japanese pages mirror the same path under `apps/docs/docs/ja/` (e.g., `ja/development/tech-stack.md`)
- Navigation is defined in `apps/docs/mkdocs.yml` under `nav:`

When you add a page, add it to `nav` and write its Japanese page. If you cannot write the Japanese, ask in **#localization** on Slack.

## Checking Your Changes

Preview the site and run the docs check from the repository root (see [Running the Code](../development/running-the-code.md#documentation-site-appsdocs) for the one-time setup):

```bash
pnpm docs
pnpm lint:docs
```

`pnpm lint:docs` fails when:

- An English page has no Japanese page, or the reverse
- A page is not listed under `nav`
- A relative link points to a file that does not exist
- A `pnpm` command in a code block names a script that no package defines
- A Node.js or pnpm version does not match `.nvmrc` or `packageManager`
- A code block uses Yarn, `npm run`, or `npx`, or a page links one of the retired single-app repos

The **Docs** workflow runs this check and a full build on every pull request. It runs on pull requests that only change code too, so renaming a script fails until the docs are updated.

## Publishing

When a change under `apps/docs` merges to `main`, the **Docs** workflow builds the site and deploys it to GitHub Pages at [docs.findadoc.jp](https://docs.findadoc.jp).
