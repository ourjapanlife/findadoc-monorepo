# Find a Doc, Japan - Developer Documentation

Documentation site for [Find a Doc, Japan](https://www.findadoc.jp) — an NPO connecting people in Japan to healthcare services in the languages they need.

Live at [docs.findadoc.jp](https://docs.findadoc.jp)

Built with [Zensical](https://github.com/zensical/zensical).

## Prerequisites

- Python >= 3.10

## Development

```bash
# Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the dev server
zensical serve
```

The site will be available at `http://127.0.0.1:8000`.

To build the static site:

```bash
zensical build --clean
```

## Project Structure

```
docs/
├── index.md                    # Homepage
├── getting-started/            # Onboarding guides
├── development/                # Tech stack, running code, architecture
├── contributing/               # Workflow, standups, code of conduct
├── ja/                         # Japanese translations (mirrors English structure)
├── assets/                     # Logo, favicon
├── stylesheets/extra.css       # Custom theme styles
└── javascripts/i18n-nav-fix.js # Fixes nav links for non-default locales
```

## Contributing

1. Join our [Slack](https://find-a-doc.slack.com/join/shared_invite/zt-2lb3j2t1z-O9F4thzcFktqsIXNzzjzHw#/shared-invite/email) and say hello in **#general** or **#dev-team**
2. Clone the repo and create a branch: `yourusername/my-change`
3. Make your changes and preview locally with `zensical serve`
4. Push your branch and open a PR

### Adding or Editing Pages

- English content lives in `docs/` (e.g., `docs/development/tech-stack.md`)
- Japanese translations mirror the same structure under `docs/ja/` (e.g., `docs/ja/development/tech-stack.md`)
- Navigation is defined in `mkdocs.yml` under `nav:`
- When adding a new page, add it to the `nav` section in `mkdocs.yml` and create the corresponding Japanese translation in `docs/ja/`

## Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions on push to `main`.

## License

[BSD 3-Clause](LICENSE)
