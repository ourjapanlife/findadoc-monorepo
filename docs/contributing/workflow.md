# Contribution Workflow

## Finding Work

1. Browse issues on any of our repos: [findadoc-web](https://github.com/ourjapanlife/findadoc-web/issues), [findadoc-server](https://github.com/ourjapanlife/findadoc-server/issues), [findadoc-mcp](https://github.com/ourjapanlife/findadoc-mcp/issues), or [findadoc-docs](https://github.com/ourjapanlife/findadoc-docs/issues)
2. Join **#dev-team** on Slack and let us know you're interested in helping out
3. Assign yourself to an issue before starting work

## Making Changes

1. Clone the repo and create a branch from `main` — prefix with your username: `yourusername/my-change`
2. Make your changes
3. Run linting and tests to make sure everything passes:

```bash
yarn lint
yarn test:unit
```

## Submitting a Pull Request

1. Push your branch and open a PR on GitHub
2. Write a clear description of what you changed and how to test it
3. Assign yourself as the PR assignee and add appropriate labels

### PR Requirements

- PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) (e.g., `feat: add search filter`, `fix: correct map marker position`)
- All automated checks and linters must pass
- Include testing instructions in the PR description

## Code Review

A maintainer will review your PR and may request changes. Once approved, the team will merge it.

## Code of Conduct

Please read and follow our [Code of Conduct](code-of-conduct.md). We are committed to providing a welcoming and inclusive community.
