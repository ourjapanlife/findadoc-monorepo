> This package lives in the [findadoc monorepo](../../README.md). It was moved here from `ourjapanlife/findadoc-docs` with its history.

# Find a Doc, Japan - Developer Documentation

Documentation site for [Find a Doc, Japan](https://www.findadoc.jp) — an NPO connecting people in Japan to healthcare services in the languages they need.

Live at [docs.findadoc.jp](https://docs.findadoc.jp)

Built with [Zensical](https://github.com/zensical/zensical).

## Prerequisites

- Python >= 3.10
- Node.js, for the docs check (see the repo-root `.nvmrc`)

## Development

```bash
# From apps/docs: create a virtual environment and install Zensical
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# From the repository root, with the virtual environment active
pnpm docs          # dev server at http://127.0.0.1:8000
pnpm docs:build    # static site in apps/docs/site
pnpm lint:docs     # check the docs against the monorepo
```

## Project Structure

```
apps/docs/
├── mkdocs.yml                      # Site config and nav
├── requirements.txt                # Zensical and plugins
├── scripts/checkDocs.mjs           # Drift check run by `pnpm lint:docs` and CI
└── docs/
    ├── index.md                    # Homepage
    ├── getting-started/            # Onboarding guides
    ├── development/                # Tech stack, running code, architecture
    ├── contributing/               # Workflow, writing docs, standups, code of conduct
    ├── ja/                         # Japanese translations (mirrors English structure)
    ├── assets/                     # Logo, favicon
    ├── stylesheets/extra.css       # Custom theme styles
    └── javascripts/i18n-nav-fix.js # Fixes nav links for non-default locales
```

## Keeping the Docs Current

Update these pages in the same pull request as the change that makes them out of date. See [Writing Docs](docs/contributing/docs.md) for what counts and what the check enforces.

- English content lives in `docs/` (e.g., `docs/development/tech-stack.md`)
- Japanese translations mirror the same structure under `docs/ja/` (e.g., `docs/ja/development/tech-stack.md`)
- Navigation is defined in `mkdocs.yml` under `nav:`

## Deployment

`.github/workflows/docs.yml` at the repository root checks and builds the site on every pull request. When `apps/docs` changes on `main`, it deploys the site to GitHub Pages at `docs.findadoc.jp`.

## License

[BSD 3-Clause](LICENSE)
